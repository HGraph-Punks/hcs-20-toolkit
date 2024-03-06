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
            const metadataFile = files.metadata[0]; // Assuming there's only one metadata file
            const topicIds = JSON.parse(fields.topicIds); // Assuming topicIds is a JSON array string
            console.log(topicIds)
            if (!metadataFile) {
                return res.status(400).json({ success: false, error: 'No metadata file uploaded' });
            }
            if (!topicIds) {
                return res.status(400).json({ success: false, error: 'No topic IDs provided' });
            }

            const metadataContent = fs.readFileSync(metadataFile.filepath, 'utf8');
            let metadataJson = JSON.parse(metadataContent);

            // Update the image attribute for each metadata object
            metadataJson = metadataJson.map((item, index) => {
                const topicId = topicIds[index].newTopicId; // Match by the same index
                if (topicId) {
                    console.log(topicId)
                    const newItem = item
                    delete newItem.edition
                    delete newItem.imageHash
                    return { ...newItem, image: `hcs://1/${topicId}` };
                }
                return item; // Return the item unchanged if no corresponding topicId
            });

            // Convert updated metadata back to Buffer for hashing and compression
            let finalJson = []
            for (let i = 0; i < metadataJson.length; i++) {
                const updatedMetadata = JSON.stringify(metadataJson[i]);
                const updatedBuffer = Buffer.from(updatedMetadata);
                const fileHash = generateFileHash(updatedBuffer);
                const compressedData = await compress(updatedBuffer, 10);
                const base64Data = compressedData.toString('base64');

                const chunkSize = 900; // Adjust chunk size as needed
                const dataPrefix = `data:application/json;base64,`;
                const chunks = chunkMessage(base64Data, chunkSize, dataPrefix);
                finalJson.push( { index:i,chunks, fileHash })
            }
           
            // Sending updated metadata back
            res.status(200).json({ success: true, finalJson });
        } catch (error) {
            console.error('Error processing metadata:', error);
            res.status(500).json({ success: false, error: `Error processing metadata: ${error.message}` });
        }
    });
}

function chunkMessage(message, chunkSize, prefix) {
    let messageArray = [];
    for (let o = 0, offset = 0; offset < message.length; o++, offset += chunkSize) {
        const chunkContent = o === 0 ? prefix + message.substring(offset, offset + chunkSize) : message.substring(offset, offset + chunkSize);
        messageArray.push({
            o, // Order
            c: chunkContent, // Content
        });
    }
    return messageArray;
}

function generateFileHash(file) {
    const hash = crypto.createHash('sha256');
    hash.update(file);
    return hash.digest('hex');
}
