import './styles.css';
import { Repository } from './data/repository';
import { createStorage } from './platform/storage';
import { App } from './ui/App';

async function main(): Promise<void> {
  const repo = new Repository(await createStorage());
  const settings = await repo.loadSettings();
  const app = new App(document.getElementById('app')!, repo, settings);
  await app.start();
}

void main();
