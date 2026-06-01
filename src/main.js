import './styles.css';
import { startApp } from './app.js';

startApp().catch((error) => {
  console.error(error);
  document.body.textContent = `Startup failed: ${error.message}`;
});
