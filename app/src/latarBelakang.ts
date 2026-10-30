// Tugas latar belakang: semak data terkini secara berkala dan hantar notifikasi
// penemuan baru. Mesti diimport di peringkat global (index.ts) sebelum app dimuatkan.
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { semakSekarang } from './semak';

export const TUGAS_SEMAK = 'bursaedge-semak-penemuan';
// Data dikemas kini sekali sehari (~6:20 ptg). Android menghormati selang ini;
// iOS menentukan sendiri masa larian berdasarkan penggunaan & bateri.
const SELANG_MINIT = 60;

TaskManager.defineTask(TUGAS_SEMAK, async () => {
  try {
    const hasil = await semakSekarang();
    return hasil.ralat ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function daftarTugas() {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
  if (!(await TaskManager.isTaskRegisteredAsync(TUGAS_SEMAK))) {
    await BackgroundTask.registerTaskAsync(TUGAS_SEMAK, { minimumInterval: SELANG_MINIT });
  }
  return true;
}

export async function statusLatar(): Promise<{ tersedia: boolean; berdaftar: boolean }> {
  const status = await BackgroundTask.getStatusAsync();
  return {
    tersedia: status === BackgroundTask.BackgroundTaskStatus.Available,
    berdaftar: await TaskManager.isTaskRegisteredAsync(TUGAS_SEMAK),
  };
}
