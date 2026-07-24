const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // สำหรับเสิร์ฟไฟล์ Frontend

// API สำหรับดึงข้อมูล Historical Chart Data (หุ้นไทย + หุ้น US + Global)
app.get('/api/chart', async (req, res) => {
    try {
        let { symbol, interval, range } = req.query;
        if (!symbol) return res.status(400).json({ error: 'กรุณาระบุชื่อหุ้น' });

        symbol = symbol.toUpperCase().trim();
        interval = interval || '1d';
        range = range || '6mo';

        // ปรับ Symbol สำหรับหุ้นไทยอัตโนมัติหากไม่ได้ใส่ .BK
        // เช่น PTT -> PTT.BK, AOT -> AOT.BK (ยกเว้นหุ้น US เช่น AAPL, NVDA, TSLA)
        let querySymbol = symbol;
        
        // ยิง request ไปยัง Yahoo Finance API
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${querySymbol}?interval=${interval}&range=${range}`;
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const result = response.data.chart.result[0];
        if (!result) throw new Error('ไม่พบข้อมูลหุ้น');

        const timestamps = result.timestamp;
        const quote = result.indicators.quote[0];
        
        // แปลงข้อมูลให้อยู่ในรูปแบบที่ TradingView Lightweight Charts ใช้งานได้
        const formattedData = [];
        for (let i = 0; i < timestamps.length; i++) {
            if (quote.open[i] !== null && quote.close[i] !== null) {
                // แปลง Timestamp เป็น YYYY-MM-DD
                const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
                formattedData.push({
                    time: date,
                    open: parseFloat(quote.open[i].toFixed(2)),
                    high: parseFloat(quote.high[i].toFixed(2)),
                    low: parseFloat(quote.low[i].toFixed(2)),
                    close: parseFloat(quote.close[i].toFixed(2)),
                    volume: quote.volume[i] || 0
                });
            }
        }

        // คืนค่าพร้อม Meta info (ราคาล่าสุด, สัญลักษณ์เต็ม)
        res.json({
            symbol: result.meta.symbol,
            currency: result.meta.currency,
            regularMarketPrice: result.meta.regularMarketPrice,
            candles: formattedData
        });

    } catch (error) {
        console.error('Error fetching chart:', error.message);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลหุ้นได้ ตรวจสอบชื่อ Symbol อีกครั้ง (เช่น PTT.BK หรือ AAPL)' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 Server Running on http://localhost:${PORT}`);
    console.log(`=================================`);
});