const CACHE_NAME = "video-offline-v1";

const FILES = [
    "./",
    "./index.html",
    "./Volcanic.mp4"
];

self.addEventListener("install", function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                return cache.addAll(FILES);
            })
            .then(function() {
                return self.skipWaiting();
            })
    );
});

self.addEventListener("activate", function(event) {
    event.waitUntil(
        self.clients.claim()
    );
});

self.addEventListener("fetch", function(event) {
    const request = event.request;
    const url = new URL(request.url);

    if (url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then(async function(cache) {
            const cached = await cache.match(request.url);

            if (cached && !request.headers.has("Range")) {
                return cached;
            }

            // Mendukung pemutaran dan pencarian posisi video
            if (url.pathname.endsWith("/Volcanic.mp4")) {
                const video = await cache.match(
                    new URL("./Volcanic.mp4", self.location.href).href
                );

                if (video && request.headers.has("Range")) {
                    const buffer = await video.arrayBuffer();
                    const range = request.headers.get("Range");
                    const match = range.match(/bytes=(\d*)-(\d*)/);

                    if (match) {
                        const size = buffer.byteLength;
                        const start = match[1] ? Number(match[1]) : 0;
                        const end = match[2]
                            ? Math.min(Number(match[2]), size - 1)
                            : size - 1;

                        if (start <= end && start < size) {
                            return new Response(
                                buffer.slice(start, end + 1),
                                {
                                    status: 206,
                                    headers: {
                                        "Content-Type": "video/mp4",
                                        "Accept-Ranges": "bytes",
                                        "Content-Range":
                                            "bytes " + start + "-" + end +
                                            "/" + size,
                                        "Content-Length":
                                            end - start + 1
                                    }
                                }
                            );
                        }

                        return new Response(null, {
                            status: 416,
                            headers: {
                                "Content-Range": "bytes */" + size
                            }
                        });
                    }
                }

                if (video) return video;
            }

            try {
                const response = await fetch(request);

                if (response.ok && request.method === "GET") {
                    await cache.put(request, response.clone());
                }

                return response;
            } catch (error) {
                if (cached) return cached;

                return new Response(
                    "File tidak tersedia secara offline.",
                    { status: 503 }
                );
            }
        })
    );
});
