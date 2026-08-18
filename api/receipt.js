import { createClient } from '@supabase/supabase-js';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
    const token = req.query.token || req.query.id;
    if (!token) return res.status(404).send('Receipt Token missing');

    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hoyowraugefllhzlmyzg.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_r-saAga04rfVIBDjmvslFA_d9p1XfFD';

    if (!supabaseKey) {
        return res.status(500).send('Server configuration missing');
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1 & 2 & 3. Validate and fetch data securely
        let { data: receiptData, error: dbError } = await supabase.from('devotees').select('*').eq('id', token).single();

        if (dbError || !receiptData) {
            // Fallback for RLS limitations using the publicly accessible RPC present in production
            const rpc = await supabase.rpc('lookup_receipt_by_id', { receipt_id: token });
            receiptData = rpc.data;
            dbError = rpc.error;
        }

        if (dbError || !receiptData || (!receiptData.receipt_no && !receiptData.receiptNo)) {
            return res.status(404).send('Receipt Not Found');
        }

        // Check if it already exists in Storage
        const fileUrl = `${supabaseUrl}/storage/v1/object/public/payment-proofs/receipts/${token}.pdf`;
        const storageResp = await fetch(fileUrl);

        // If it exists in storage (from our new auto-upload), stream it directly!
        if (storageResp.ok) {
            const arrayBuffer = await storageResp.arrayBuffer();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="receipt-${token}.pdf"`);
            return res.send(Buffer.from(arrayBuffer));
        }

        // 4. Generate/use the existing official PDF dynamically
        // Since it's not in storage, we use the exact React component via headless Chromium
        const browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();

        // Set higher resolution scale
        await page.setViewport({ width: 1024, height: 1123, deviceScaleFactor: 2 });

        // Using existing React route that renders the receipt securely
        const origin = 'https://svsvbb.vercel.app';
        await page.goto(`${origin}/preview-receipt/${token}`, { waitUntil: 'networkidle0' });

        // Await the DOM element
        await page.waitForSelector('#receipt-export-container');

        // Hide UI elements to get cleanly printed view
        await page.evaluate(() => {
            const buttons = document.querySelectorAll('button');
            buttons.forEach(btn => btn.style.display = 'none');
        });

        // Take PDF matching A4 dimensions and colors exactly as rendered natively
        const pdfBytes = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' }
        });

        await browser.close();

        // Bonus: Upload it to cache for next time perfectly replicating client behavior
        await supabase.storage.from('payment-proofs').upload(`receipts/${token}.pdf`, pdfBytes, {
            contentType: 'application/pdf',
            upsert: true
        });

        // 5. Return the PDF directly
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="receipt-${token}.pdf"`);
        res.send(pdfBytes);

    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).send('Failed to fetch receipt');
    }
}
