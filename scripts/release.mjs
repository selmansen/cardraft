#!/usr/bin/env node
/**
 * Yayın hazırlama: sürümü yükseltir, CHANGELOG'u kapatır, etiketi oluşturur.
 *
 * Kullanım:
 *   node scripts/release.mjs app patch|minor|major
 *   node scripts/release.mjs server patch|minor|major
 *
 * Neden script:
 *   Uygulamanın sürümü İKİ dosyada yazılı (app.json ve package.json) ve
 *   ikisi ayrışırsa mağazaya giden numara ile repodaki numara birbirini
 *   tutmaz. Elle yapılınca er geç biri unutulur. Ayrıca "CHANGELOG'u
 *   kapatmayı unutma" gibi bir kural, script'e dönüşmediği sürece kuraldır
 *   ve kurallar unutulur.
 *
 * Bilerek YAPMADIĞI şey: itmek (push). Etiket itmek yayın tetikler —
 * geri alınması zor ve dışarı dönük bir iş. Script hazırlar, iten sen olursun.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const COMPONENTS = {
  app: {
    label: 'Mobil uygulama',
    tagPrefix: 'app-v',
    changelog: 'CHANGELOG.md',
    // Uygulamanın sürümü iki yerde: Expo yapılandırması ve npm manifest'i.
    manifests: ['app.json', 'package.json'],
  },
  server: {
    label: 'Sunucu (API)',
    tagPrefix: 'server-v',
    changelog: 'server/CHANGELOG.md',
    manifests: ['server/package.json'],
  },
};

const UNRELEASED = '## [Yayınlanmamış]';

function fail(message) {
  console.error(`\n  HATA: ${message}\n`);
  process.exit(1);
}

function git(command) {
  return execSync(`git ${command}`, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function readJson(relative) {
  return JSON.parse(readFileSync(join(ROOT, relative), 'utf8'));
}

/** Sürümü okur: app.json'da expo.version, package.json'da version. */
function versionOf(relative) {
  const json = readJson(relative);
  return relative.endsWith('app.json') ? json.expo.version : json.version;
}

function writeVersion(relative, version) {
  const path = join(ROOT, relative);
  const json = JSON.parse(readFileSync(path, 'utf8'));
  if (relative.endsWith('app.json')) json.expo.version = version;
  else json.version = version;
  writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
}

function bump(version, kind) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) fail(`Sürüm semver değil: ${version}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/**
 * CHANGELOG'daki "Yayınlanmamış" bölümünü sürüm başlığına çevirir ve
 * üstüne yeni bir boş "Yayınlanmamış" açar.
 */
function closeChangelog(relative, version) {
  const path = join(ROOT, relative);
  const text = readFileSync(path, 'utf8');

  const start = text.indexOf(UNRELEASED);
  if (start === -1) fail(`${relative} içinde "${UNRELEASED}" başlığı yok.`);

  const bodyStart = start + UNRELEASED.length;
  const next = text.indexOf('\n## ', bodyStart);
  const body = text.slice(bodyStart, next === -1 ? undefined : next).trim();

  if (!body) {
    fail(
      `${relative} içindeki "Yayınlanmamış" bölümü boş.\n` +
        '  Yayınlanacak bir şey yoksa yayın da yok; varsa önce yaz.',
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  const replacement = `${UNRELEASED}\n\n## [${version}] — ${date}\n\n${body}\n`;
  writeFileSync(path, text.slice(0, start) + replacement + text.slice(next === -1 ? text.length : next));
  return body;
}

// ─────────────────────────────── Akış ───────────────────────────────
const [name, kind = 'patch'] = process.argv.slice(2);
const component = COMPONENTS[name];

if (!component) {
  fail(`Bileşen "app" ya da "server" olmalı.\n  Kullanım: node scripts/release.mjs <app|server> <patch|minor|major>`);
}
if (!['patch', 'minor', 'major'].includes(kind)) {
  fail(`Yükseltme türü patch, minor ya da major olmalı (verilen: ${kind}).`);
}

// Yayın main'den çıkar: etiketlenen şey prod'a giden koddur.
const branch = git('rev-parse --abbrev-ref HEAD');
if (branch !== 'main') {
  fail(`Yayın main'den yapılır, şu an "${branch}" dalındasın.\n  Önce develop → main PR'ını birleştir.`);
}
if (git('status --porcelain')) {
  fail('Çalışma ağacı temiz değil. Önce değişiklikleri işle ya da sakla.');
}

const current = versionOf(component.manifests[0]);
const next = bump(current, kind);
const tag = `${component.tagPrefix}${next}`;

const existing = git('tag --list').split('\n');
if (existing.includes(tag)) fail(`${tag} etiketi zaten var.`);

// Manifestlerin sürümü baştan ayrışmış mı — sessizce üstüne yazmak yerine söyle.
for (const manifest of component.manifests) {
  const found = versionOf(manifest);
  if (found !== current) {
    fail(`Sürümler ayrışmış: ${component.manifests[0]}=${current}, ${manifest}=${found}.\n  Elle eşitle, sonra tekrar dene.`);
  }
}

const notes = closeChangelog(component.changelog, next);
for (const manifest of component.manifests) writeVersion(manifest, next);

git(`add ${[component.changelog, ...component.manifests].join(' ')}`);
execSync(`git commit -m "chore(release): ${name} v${next}"`, { cwd: ROOT, stdio: 'inherit' });
execSync(`git tag -a ${tag} -m "${component.label} v${next}"`, { cwd: ROOT, stdio: 'inherit' });

console.log(`
  ${component.label}: ${current} → ${next}
  Etiket hazır: ${tag}

  Sürüm notları:
${notes.split('\n').map((line) => `    ${line}`).join('\n')}

  Yayınlamak için (etiket itilince GitHub Release oluşur):
    git push origin main ${tag}
`);
