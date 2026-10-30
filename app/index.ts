import { registerRootComponent } from 'expo';

// Tugas latar belakang mesti ditakrif di peringkat global sebelum app dimuatkan
import './src/latarBelakang';
import App from './App';

registerRootComponent(App);
