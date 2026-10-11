import { GameApp } from './app/GameApp';
import './styles/main.css';

const root = document.getElementById('app');

if (!root) {
  throw new Error('NEON STRIKE root element #app was not found.');
}

const app = new GameApp(root);
void app.start();

if (import.meta.env.DEV) {
  window.addEventListener('pagehide', () => app.dispose(), { once: true });
}
