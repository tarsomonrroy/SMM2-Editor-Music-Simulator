import pygame
import random
import time
import threading
import tkinter as tk
from tkinter import ttk

NUM_TRACKS = 7
ACTIVE_TRACKS = 3
FADE_DURATION = 1000  # ms
SWAP_INTERVAL = 10     # seconds

class MusicController:
    def __init__(self, base_name, loop_point):
        pygame.mixer.init()
        self.tracks = []
        self.channels = []
        self.base_name = base_name
        self.loop_point = loop_point
        self.running = False
        self.swap_thread = None
        self.start_time = 0

        for i in range(1, NUM_TRACKS + 1):
            path = f"{base_name}{i}.ogg"
            sound = pygame.mixer.Sound(path)
            self.tracks.append(sound)
            self.channels.append(pygame.mixer.Channel(i - 1))

    def play_all(self):
        self.running = True
        self.start_time = time.time()

        for i, sound in enumerate(self.tracks):
            self.channels[i].play(sound, loops=-1, fade_ms=FADE_DURATION)
            self.channels[i].set_volume(0.0)

        self.active_indices = random.sample(range(NUM_TRACKS), ACTIVE_TRACKS)
        for i in self.active_indices:
            self.channels[i].set_volume(1.0)

        self.swap_thread = threading.Thread(target=self._swap_loop, daemon=True)
        self.swap_thread.start()

        threading.Thread(target=self._loop_checker, daemon=True).start()

    def stop_all(self):
        self.running = False
        for ch in self.channels:
            ch.stop()

    def _swap_loop(self):
        while self.running:
            time.sleep(SWAP_INTERVAL)
            inactive = [i for i in range(NUM_TRACKS) if i not in self.active_indices]
            if not inactive:
                continue
            out_idx = random.choice(self.active_indices)
            in_idx = random.choice(inactive)

            self.channels[out_idx].fadeout(FADE_DURATION)
            self.channels[in_idx].play(self.tracks[in_idx], loops=-1, fade_ms=FADE_DURATION)
            self.channels[in_idx].set_volume(1.0)

            self.active_indices.remove(out_idx)
            self.active_indices.append(in_idx)

    def _loop_checker(self):
        while self.running:
            if time.time() - self.start_time >= self.tracks[0].get_length():
                for ch in self.channels:
                    ch.stop()
                time.sleep(0.1)
                self.play_all()
            time.sleep(0.5)

# GUI
class App:
    def __init__(self, root):
        self.root = root
        self.root.title("Music Prototype")
        self.controller = None

        # Ícone da janela
        try:
            self.root.iconbitmap("icon.ico")
        except:
            pass  # Se não encontrar, ignora

        # Interface
        self.base_var = tk.StringVar()
        self.loop_var = tk.DoubleVar()

        ttk.Label(root, text="Nome base das faixas:").grid(row=0, column=0, padx=10, pady=5, sticky="e")
        ttk.Entry(root, textvariable=self.base_var).grid(row=0, column=1, padx=10, pady=5)

        ttk.Label(root, text="Loop point (segundos):").grid(row=1, column=0, padx=10, pady=5, sticky="e")
        ttk.Entry(root, textvariable=self.loop_var).grid(row=1, column=1, padx=10, pady=5)

        ttk.Button(root, text="Play", command=self.play).grid(row=2, column=0, padx=10, pady=10)
        ttk.Button(root, text="Stop", command=self.stop).grid(row=2, column=1, padx=10, pady=10)
        ttk.Button(root, text="Sair", command=self.quit).grid(row=3, column=0, columnspan=2, pady=10)

    def play(self):
        if self.controller:
            self.controller.stop_all()
        base = self.base_var.get()
        loop = self.loop_var.get()
        self.controller = MusicController(base, loop)
        self.controller.play_all()

    def stop(self):
        if self.controller:
            self.controller.stop_all()

    def quit(self):
        self.stop()
        self.root.destroy()

if __name__ == "__main__":
    root = tk.Tk()
    App(root)
    root.mainloop()
