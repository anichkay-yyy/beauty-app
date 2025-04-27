const getIcons = (srcIconPath, srcOutputPath, manifestOutputPath) => {
        const iconManifest = [];
        const sizes = [
                "72x72",
                "96x96",
                "128x128",
                "144x144",
                "152x152",
                "167x167",
                "180x180",
                "192x192",
                "256x256",
                "384x384",
                "512x512",
                "1024x1024"
        ];

        for (const size of sizes) {
                const name = `icon-${size}.png`;
                iconManifest.push({
                        "src": manifestOutputPath + name,
                        "sizes": size,
                        "type": "image/png",
                        "purpose": "any"
                });
        }

        iconManifest.push({
                "src": manifestOutputPath + `icon-512x512_maksable.png`,
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "maksable"
        });

        return iconManifest;
};

module.exports = { getIcons };