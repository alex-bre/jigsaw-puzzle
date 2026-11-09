import './styles.css';
import { detectLanguage, setLanguage, t } from './i18n';
import { App } from './ui/App';

setLanguage(detectLanguage());
document.title = t('appTitle');

const app = new App(document.getElementById('app')!);
void app.start();
