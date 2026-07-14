const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const INPUT = path.join(__dirname, "..", "public");
const OUTPUT = path.join(__dirname, "..", "optimized-public");

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

async function processFile(inputFile, outputFile) {
  await fs.promises.mkdir(path.dirname(outputFile), { recursive: true });

  const ext = path.extname(inputFile).toLowerCase();

  let image = sharp(inputFile).rotate();

  const metadata = await image.metadata();

  // Resize only huge images
  if (metadata.width && metadata.width > 1600) {
    image = image.resize({
      width: 1600,
      withoutEnlargement: true,
    });
  }

  if (ext === ".png") {
    await image.png({
      compressionLevel: 9,
    }).toFile(outputFile);
  } else if (ext === ".webp") {
    await image.webp({
      quality: 80,
    }).toFile(outputFile);
  } else {
    await image.jpeg({
      quality: 80,
      mozjpeg: true,
    }).toFile(outputFile);
  }

  console.log("✓", path.relative(INPUT, inputFile));
}

async function walk(folder) {
  const entries = await fs.promises.readdir(folder, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const inputPath = path.join(folder, entry.name);

    const relative = path.relative(INPUT, inputPath);

    const outputPath = path.join(OUTPUT, relative);

    if (entry.isDirectory()) {
      await walk(inputPath);
    } else {
      const ext = path.extname(entry.name).toLowerCase();

      if (IMAGE_EXTENSIONS.includes(ext)) {
        await processFile(inputPath, outputPath);
      } else {
        await fs.promises.mkdir(path.dirname(outputPath), {
          recursive: true,
        });

        await fs.promises.copyFile(inputPath, outputPath);
      }
    }
  }
}

(async () => {
  console.log("Optimizing images...");

  await walk(INPUT);

  console.log("\n✅ Finished.");
  console.log("Output folder:");
  console.log("optimized-public");
})();