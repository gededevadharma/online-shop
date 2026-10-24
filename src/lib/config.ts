import configData from '@/config.json';

interface Config {
    auth: {
        jwtSecret: string;
        adminUsername: string;
        adminPassword: string;
        adminEmail: string;
    };
    app: {
        url: string;
        name: string;
    };
    midtrans: {
        serverKey: string;
        clientKey: string;
        isProduction: boolean;
    };
    turnstile: {
        siteKey: string;
        secretKey: string;
    };
}

const config: Config = configData as Config;

export default config;
