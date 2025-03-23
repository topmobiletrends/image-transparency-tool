const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Enable CORS for all routes
app.use(cors());

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// Ensure the 'processed' directory exists
const processedDir = path.join(__dirname, 'processed');
if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir);
}

// Handle file upload and processing
app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        const imagePath = req.file.path;
        const outputPath = path.join(processedDir, `${Date.now()}.png`);

        // Get user inputs
        const transparencyColor = req.body.transparencyColor || '#FFFFFF'; // Default to white
        const similarityThreshold = parseFloat(req.body.similarityThreshold) || 30; // Default to 30%
        const edgeSmoothing = req.body.edgeSmoothing === 'true'; // Default to false

        // Convert hex color to RGB
        const hexToRgb = (hex) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return { r, g, b };
        };
        const color = hexToRgb(transparencyColor);

        // Load the image
        const image = sharp(imagePath);

        // Apply transparency based on the selected color and similarity threshold
        const { data, info } = await image
            .ensureAlpha() // Ensure the image has an alpha channel
            .raw()
            .toBuffer({ resolveWithObject: true });

        const pixels = new Uint8Array(data);
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];

            // Calculate color difference
            const diff = Math.sqrt(
                Math.pow(r - color.r, 2) +
                Math.pow(g - color.g, 2) +
                Math.pow(b - color.b, 2)
            );

            // If the color is within the similarity threshold, make it transparent
            if (diff <= similarityThreshold) {
                pixels[i + 3] = 0; // Set alpha to 0 (fully transparent)
            }
        }

        // Save the processed image
        await sharp(pixels, {
            raw: {
                width: info.width,
                height: info.height,
                channels: 4,
            },
        })
            .toFile(outputPath);

        // Send the processed image back to the client
        res.download(outputPath, (err) => {
            if (err) {
                console.error('Error sending file:', err);
                res.status(500).send('Error sending file');
            }

            // Clean up uploaded and processed files
            fs.unlinkSync(imagePath);
            fs.unlinkSync(outputPath);
        });
    } catch (error) {
        console.error('Error processing image:', error);
        res.status(500).send('Error processing image');
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));