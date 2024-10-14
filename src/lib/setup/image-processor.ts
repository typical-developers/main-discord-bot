import { container } from '@sapphire/pieces';
import puppeteer from 'puppeteer';
import HTMLImageProcessor from "#lib/structures/HTMLImageProcessor"

container.imageProcessor = await HTMLImageProcessor.launch({
    executablePath: process.env.DEV_DEPLOYMENT === 'true' ? puppeteer.executablePath() : '/usr/bin/google-chrome-stable',
    headless: "shell",
    args: [
        '--disable-gpu',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote'
    ]
});