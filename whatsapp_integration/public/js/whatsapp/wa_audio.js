// wa.audio — WhatsApp-style voice-note player with play/pause, seek and duration
frappe.provide("wa.audio");

wa.audio.sequence = wa.audio.sequence || 0;
wa.audio.icons = {
    play: "&#9654;",
    pause: "&#10074;&#10074;"
};

wa.audio.render = function (fileUrl) {
    const id = `wa-audio-${Date.now()}-${wa.audio.sequence++}`;
    const safeUrl = frappe.utils.escape_html(fileUrl);

    return `<div class="wa-audio-player" id="${id}">
        <audio preload="metadata" src="${safeUrl}"></audio>
        <button class="wa-audio-play" type="button" data-state="play" aria-label="Play audio">
            <span class="wa-audio-play-icon" aria-hidden="true">${wa.audio.icons.play}</span>
        </button>
        <div class="wa-audio-progress" role="slider" tabindex="0" aria-label="Audio position" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <div class="wa-audio-fill"></div>
            <span class="wa-audio-thumb"></span>
        </div>
        <span class="wa-audio-time">0:00</span>
    </div>`;
};

wa.audio.format_duration = function (seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${remainder}`;
};

wa.audio.set_button_state = function ($player, state) {
    const isPlaying = state === "pause";
    $player.toggleClass("is-playing", isPlaying);
    $player
        .find(".wa-audio-play")
        .attr("data-state", isPlaying ? "pause" : "play")
        .attr("aria-label", isPlaying ? "Pause audio" : "Play audio")
        .find(".wa-audio-play-icon")
        .html(isPlaying ? wa.audio.icons.pause : wa.audio.icons.play);
};

wa.audio.update_progress = function ($player, audio) {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const percentage = duration ? Math.min(100, Math.max(0, (audio.currentTime / duration) * 100)) : 0;
    $player.find(".wa-audio-fill").css("width", `${percentage}%`);
    $player.find(".wa-audio-thumb").css("left", `${percentage}%`);
    $player.find(".wa-audio-progress").attr("aria-valuenow", Math.round(percentage));
    $player.find(".wa-audio-time").text(
        wa.audio.format_duration(audio.currentTime > 0 ? Math.max(0, duration - audio.currentTime) : duration)
    );
};

wa.audio.pause_other_players = function (currentAudio) {
    $(".wa-audio-player audio").each(function () {
        if (this !== currentAudio && !this.paused) this.pause();
    });
};

wa.audio.bind_all = function () {
    $(".wa-audio-player").each(function () {
        const $player = $(this);
        if ($player.data("wa-audio-bound")) return;
        $player.data("wa-audio-bound", true);

        const audio = $player.find("audio")[0];
        const $button = $player.find(".wa-audio-play");
        const $progress = $player.find(".wa-audio-progress");

        if (!audio) return;

        const refresh = () => wa.audio.update_progress($player, audio);
        audio.addEventListener("loadedmetadata", refresh);
        audio.addEventListener("durationchange", refresh);
        audio.addEventListener("timeupdate", refresh);
        audio.addEventListener("play", () => wa.audio.set_button_state($player, "pause"));
        audio.addEventListener("pause", () => wa.audio.set_button_state($player, "play"));
        audio.addEventListener("ended", () => {
            audio.currentTime = 0;
            wa.audio.set_button_state($player, "play");
            refresh();
        });
        audio.addEventListener("error", () => {
            $player.addClass("has-error");
            $button.prop("disabled", true).attr("aria-label", "Audio unavailable");
            $player.find(".wa-audio-time").text("Unavailable");
        });

        $button.on("click", function () {
            if (audio.paused) {
                wa.audio.pause_other_players(audio);
                const playPromise = audio.play();
                if (playPromise && typeof playPromise.catch === "function") {
                    playPromise.catch(() => wa.audio.set_button_state($player, "play"));
                }
            } else {
                audio.pause();
            }
        });

        const seek = (ratio) => {
            if (!Number.isFinite(audio.duration) || !audio.duration) return;
            audio.currentTime = Math.min(audio.duration, Math.max(0, ratio * audio.duration));
            refresh();
        };

        $progress.on("click", function (event) {
            const rect = this.getBoundingClientRect();
            if (!rect.width) return;
            seek((event.clientX - rect.left) / rect.width);
        });

        $progress.on("keydown", function (event) {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            if (!Number.isFinite(audio.duration) || !audio.duration) return;
            const nextTime = audio.currentTime + (event.key === "ArrowRight" ? 5 : -5);
            seek(nextTime / audio.duration);
        });

        if (audio.readyState >= 1) refresh();
    });
};
