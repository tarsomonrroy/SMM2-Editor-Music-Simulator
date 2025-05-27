import pygame
import random
import time
import threading
import tkinter as tk
from tkinter import ttk

NUM_TRACKS = 7
ACTIVE_TRACKS = 4
FADE_DURATION = 4000  # ms
SWAP_INTERVAL = 15    # seconds

class MusicController:
    def __init__(self, base_name, loop_point, status_callback):
        pygame.mixer.init()
        self.tracks = []
        self.channels = []
        self.base_name = base_name
        self.loop_point = loop_point
        self.running = False
        self.swap_thread = None
        self.loop_thread = None
        self.active_indices = []
        self.status_callback = status_callback

        for i in range(1, NUM_TRACKS + 1):
            path = f"musics/{base_name}{i}.ogg"
            sound = pygame.mixer.Sound(path)
            self.tracks.append(sound)
            self.channels.append(pygame.mixer.Channel(i - 1))

    def play_all(self):
        self.running = True
        self.active_indices = random.sample(range(NUM_TRACKS), ACTIVE_TRACKS)

        for i in range(NUM_TRACKS):
            self.channels[i].play(self.tracks[i])
            self.channels[i].set_volume(1.0 if i in self.active_indices else 0.0)

        self.status_callback(self.active_indices)

        self.swap_thread = threading.Thread(target=self._swap_loop, daemon=True)
        self.swap_thread.start()

        self.loop_thread = threading.Thread(target=self._loop_manager, daemon=True)
        self.loop_thread.start()

    def stop_all(self):
        self.running = False
        for ch in self.channels:
            ch.stop()

    def fade_volume(self, index, start, end, duration_ms):
        steps = 20
        delay = duration_ms / steps / 1000.0
        diff = (end - start) / steps

        def fade():
            vol = start
            for _ in range(steps):
                vol += diff
                vol = max(0.0, min(1.0, vol))
                self.channels[index].set_volume(vol)
                time.sleep(delay)

        threading.Thread(target=fade, daemon=True).start()

    def _swap_loop(self):
        while self.running:
            time.sleep(SWAP_INTERVAL)
            inactive = [i for i in range(NUM_TRACKS) if i not in self.active_indices]
            if not inactive:
                continue
            out_idx = random.choice(self.active_indices)
            in_idx = random.choice(inactive)
            self.fade_volume(out_idx, 1.0, 0.0, FADE_DURATION)
            self.fade_volume(in_idx, 0.0, 1.0, FADE_DURATION)
            self.active_indices.remove(out_idx)
            self.active_indices.append(in_idx)
            self.status_callback(self.active_indices)

    def _loop_manager(self):
        intro_duration = self.loop_point
        longest_track = max([s.get_length() for s in self.tracks])
        while self.running:
            time.sleep(intro_duration)
            # Após introdução, entrar em modo de loop
            while self.running:
                time.sleep(0.1)
                for i in range(NUM_TRACKS):
                    if not self.channels[i].get_busy():
                        self.channels[i].play(self.tracks[i], fade_ms=50)
                        self.channels[i].set_volume(
                            1.0 if i in self.active_indices else 0.0
                        )
                        self._seek_to_loop_point(i)

    def _seek_to_loop_point(self, index):
        # Pygame não tem set_pos. Mas podemos simular:
        # Criando novo Sound a partir do ponto de loop (se fosse usar pydub), ou
        # simulando uma espera antes de tocar (já feito). Aqui, só controle.

        # Como .play() começa do início, esperamos self.loop_point e recomeçamos
        # a faixa apenas se ela terminar.
        pass  # placeholder caso precise de expansão futura

# GUI
class App:
    def __init__(self, root):
        self.root = root
        self.root.title("Music Prototype")
        self.controller = None

        try:
            self.root.iconbitmap("icon.ico")
        except:
            pass

        self.base_var = tk.StringVar()
        self.loop_var = tk.DoubleVar()
        self.status_labels = []

        ttk.Label(root, text="Nome base das faixas:").grid(row=0, column=0, padx=10, pady=5, sticky="e")
        ttk.Entry(root, textvariable=self.base_var).grid(row=0, column=1, padx=10, pady=5)

        ttk.Label(root, text="Loop point (segundos):").grid(row=1, column=0, padx=10, pady=5, sticky="e")
        ttk.Entry(root, textvariable=self.loop_var).grid(row=1, column=1, padx=10, pady=5)

        ttk.Button(root, text="Play", command=self.play).grid(row=2, column=0, padx=10, pady=10)
        ttk.Button(root, text="Stop", command=self.stop).grid(row=2, column=1, padx=10, pady=10)
        ttk.Button(root, text="Sair", command=self.quit).grid(row=3, column=0, columnspan=2, pady=10)

        # Status das faixas
        status_frame = ttk.LabelFrame(root, text="Faixas Ativas")
        status_frame.grid(row=4, column=0, columnspan=2, padx=10, pady=10)
        for i in range(NUM_TRACKS):
            label = ttk.Label(status_frame, text=f"Faixa {i+1}: INATIVA")
            label.grid(row=i // 2, column=i % 2, padx=5, pady=2, sticky="w")
            self.status_labels.append(label)

    def update_status(self, active_indices):
        for i in range(NUM_TRACKS):
            if i in active_indices:
                self.status_labels[i].configure(text=f"Faixa {i+1}: ATIVA", foreground="green")
            else:
                self.status_labels[i].configure(text=f"Faixa {i+1}: INATIVA", foreground="gray")

    def play(self):
        if self.controller:
            self.controller.stop_all()
        base = self.base_var.get()
        loop = self.loop_var.get()
        self.controller = MusicController(base, loop, self.update_status)
        self.controller.play_all()

    def stop(self):
        if self.controller:
            self.controller.stop_all()
            self.update_status([])

    def quit(self):
        self.stop()
        self.root.destroy()

if __name__ == "__main__":
    root = tk.Tk()
    App(root)
    root.mainloop()
