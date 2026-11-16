// The UI kit's styles first, so the app's layout rules can build on them.
import './ui/kit';
import './styles.css';
import { Repository } from './data/repository';
import { appReady } from './platform/device';
import { createStorage } from './platform/storage';
import { App } from './ui/App';

async function main(): Promise<void> {
  const repo = new Repository(await createStorage());
  const settings = await repo.loadSettings();
  const app = new App(document.getElementById('app')!, repo, settings);
  await app.start();
}

main().catch((err) => {
  console.error('Start failed', err);
  appReady(); // never leave the player stuck on the splash screen
});
