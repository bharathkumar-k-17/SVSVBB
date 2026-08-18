export default async function handler(req, res) {
    const token = req.query.token || req.query.id;
    if (!token) return res.status(400).send('Receipt Token missing');

    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kbhfvxckysuikofnblja.supabase.co';
    const url = `${supabaseUrl}/storage/v1/object/public/payment-proofs/receipts/${token}.pdf`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            return res.status(404).send('Receipt Not Found');
        }

        const arrayBuffer = await response.arrayBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="receipt-${token}.pdf"`);
        res.send(Buffer.from(arrayBuffer));
    } catch (error) {
        res.status(500).send('Failed to fetch receipt');
    }
}
