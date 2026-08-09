const https = require('https');
const fs = require('fs');

const download = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return download(response.headers.location, dest).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

const run = async () => {
  fs.mkdirSync('public/payment', { recursive: true });
  try {
    await download('https://upload.wikimedia.org/wikipedia/commons/7/71/PhonePe_Logo.svg', 'public/payment/phonepe.svg');
    await download('https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg', 'public/payment/gpay.svg');
    await download('https://upload.wikimedia.org/wikipedia/commons/2/24/Paytm_Logo_%28standalone%29.svg', 'public/payment/paytm.svg');
    await download('https://upload.wikimedia.org/wikipedia/commons/a/ad/BHIM_SVG_Logo.svg', 'public/payment/bhim.svg');
    await download('https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo-vector.svg', 'public/payment/upi.svg');
    console.log("Success");
  } catch (e) {
    console.error(e);
  }
};
run();
