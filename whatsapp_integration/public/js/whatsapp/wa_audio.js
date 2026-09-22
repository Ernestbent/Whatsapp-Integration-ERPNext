// wa.audio — custom voice-note player, replaces the plain <audio controls> element
frappe.provide("wa.audio");

let audio_seq = 0;

// Builds the player HTML for one audio message. Call this from wa.messages instead
// of returning a bare <audio> tag, then call wa.audio.bind_all() after the HTML is in the DOM.
wa.audio.render = function (file_url) {
    const id = `wa-audio-${Date.now()}-${audio_seq++}`;
    const safeUrl = frappe.utils.escape_html(file_url);
    return `<div class="wa-audio-player" id="${id}">
        <audio preload="metadata" src="${safeUrl}" style="display:none;"></audio>
        <button class="wa-audio-play" data-state="play">&#9654;</button>
        <div class="wa-audio-progress"><div class="wa-audio-fill"></div></div>
        <span class="wa-audio-time">0:00</span>
    </div>`;
};

function format_duration(seconds) {
    if (!isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60)
        .toString()
        .padStart(2, "0");
    return `${m}:${s}`;
}

// Wires play/pause, progress fill, seeking and duration display for every player on the page.
// Call once after appending message HTML (wa.messages.load_messages already does this).
wa.audio.bind_all = function () {
    $(".wa-audio-player").each(function () {
        const $player = $(this);
        if ($player.data("wa-audio-bound")) return;
        $player.data("wa-audio-bound", true);

        const audio = $player.find("audio")[0];
        const $btn = $player.find(".wa-audio-play");
        const $fill = $player.find(".wa-audio-fill");
        const $progress = $player.find(".wa-audio-progress");
        const $time = $player.find(".wa-audio-time");

        audio.addEventListener("loadedmetadata", () => {
            $time.text(format_duration(audio.duration));
        });

        audio.addEventListener("timeupdate", () => {
            if (!audio.duration) return;
            const pct = (audio.currentTime / audio.duration) * 100;
            $fill.css("width", pct + "%");
            $time.text(format_duration(audio.duration - audio.currentTime));
        });

        audio.addEventListener("ended", () => {
            $btn.attr("data-state", "play").html("&#9654;");
            $fill.css("width", "0%");
            $time.text(format_duration(audio.duration));
        });

        $btn.on("click", () => {
            // Pauses every other player so only one voice note plays at a time
            $(".wa-audio-player audio").each(function () {
                if (this !== audio && !this.paused) {
                    this.pause();
                    $(this)
                        .closest(".wa-audio-player")
                        .find(".wa-audio-play")
                        .attr("data-state", "play")
                        .html("&#9654;");
                }
            });

            if (audio.paused) {
                audio.play();
                $btn.attr("data-state", "pause").html("&#10074;&#10074;");
            } else {
                audio.pause();
                $btn.attr("data-state", "play").html("&#9654;");
            }
        });

        $progress.on("click", function (e) {
            if (!audio.duration) return;
            const rect = this.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            audio.currentTime = ratio * audio.duration;
        });
    });
};