// pages/api/fetchFromTopic.js
import axios from 'axios';

export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { topicId } = req.query; // Assuming the topic ID is passed as a query parameter

    if (!topicId) {
        return res.status(400).json({ error: 'Topic ID is required' });
    }

    try {
        const messages = [];
        let lastConsensusTimestamp = null;

        // Fetch all messages from the topic
        while (true) {
            const response = await axios.get(`https://mainnet-public.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?timestamp=gte:${lastConsensusTimestamp || 0}`);
            const newMessages = response.data.messages;

            if (newMessages.length === 0) break;

            messages.push(...newMessages);
            lastConsensusTimestamp = newMessages[newMessages.length - 1].consensus_timestamp;
        }

        // Sort and compile messages
        messages.sort((a, b) => a.sequence_number - b.sequence_number);
        const combinedData = messages.map(msg => msg.message).join('');

        // Optionally, add decompression here if your data was compressed before being added to HCS

        // Respond with compiled data
        res.status(200).json({ success: true, data: combinedData });
    } catch (error) {
        console.error('Error fetching and compiling data:', error);
        res.status(500).json({ success: false, error: 'Error fetching and compiling data' });
    }
}
