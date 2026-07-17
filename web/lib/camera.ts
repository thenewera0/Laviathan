// One-shot camera capture for the `see` tool. The camera activates only
// while a frame is being taken — the browser permission prompt and
// hardware indicator make that visible — then every track is stopped.

// One-shot screen capture for `see_screen`. The browser's share picker
// IS the consent step — the user chooses exactly which window to show,
// one frame is taken, and the share ends immediately.
export async function captureScreen(): Promise<string | null> {
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: 1920 } },
    });
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((r) => setTimeout(r, 250));

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.8).split(",")[1] ?? null;
  } catch {
    return null;
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}

export async function captureFrame(): Promise<string | null> {
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();

    // Give auto-exposure a beat so the frame isn't black
    await new Promise((r) => setTimeout(r, 350));

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);

    // strip the data-url prefix — the backend wants raw base64
    return canvas.toDataURL("image/jpeg", 0.75).split(",")[1] ?? null;
  } catch {
    return null;
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}
