import { compress } from '@mongodb-js/zstd';
import formidable from 'formidable';
import fs from 'fs';
import crypto from 'crypto';

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        // Handle non-POST requests
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const form = formidable();
    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('Formidable parsing error:', err);
            return res.status(500).json({ success: false, error: 'Error parsing form data' });
        }

        try {
            // Assuming 'images' is the field name for the uploaded file
            const imageFile = files.image[0]; // Only processing the first file

            if (!imageFile) {
                return res.status(400).json({ success: false, error: 'No image file uploaded' });
            }
            console.log(imageFile)

            const fileData = fs.readFileSync(imageFile.filepath);
            const fileHash = generateFileHash(Buffer.from(fileData))
            const compressedData = await compress(fileData, 10);
            const base64Data = compressedData.toString('base64');

            // TODO: add in dynamic byte sizing to exactly fit 1 kb per message
            const constantPart = JSON.stringify({ c: '', o: 0 });
            const constantPartLength = constantPart.length;
            const estimatedMaxChunks = Math.ceil(base64Data.length / 900);
            const maxOSize = estimatedMaxChunks.toString().length;

            const maxDataSizePerMessage = 900 - constantPartLength - maxOSize;
            console.log(maxDataSizePerMessage)
            // Determine MIME type from file extension, default to 'application/octet-stream' if unknown
            const mimeType = imageFile.mimetype;

            // Adjust chunk size as needed
            const chunkSize = maxDataSizePerMessage; 
            const dataPrefix = `data:${mimeType};base64,`;
            const chunks = chunkMessage(base64Data, chunkSize, dataPrefix);

            // Only sending data for one file
            res.status(200).json({ success: true, chunkedImage: { index: parseInt(imageFile.originalFilename.split('/')[1].split('.')[0]), chunks, fileHash } });
        } catch (error) {
            console.error('Error processing file:', error);
            res.status(500).json({ success: false, error: `Error processing file: ${error.message}` });
        }
    });
}

function chunkMessage(message, chunkSize, prefix) {
    // TODO: Make chunks as efficient as possible with bytes
    let messageArray = [];
    for (let o = 0, offset = 0; offset < message.length; o++, offset += chunkSize) {
        // Adding prefix only to the first chunk
        const chunkContent = o === 0 ? prefix + message.slice(offset, offset + chunkSize) : message.slice(offset, offset + chunkSize);
        messageArray.push({
            o, // Order
            c: chunkContent, // Content
        });
    }
    return messageArray;
}

function generateFileHash (file) {
    const hash = crypto.createHash('sha256');
    hash.update(file);
    return hash.digest('hex');
}