import 'server-only';
import QRCode from 'qrcode';

/** QR as inline SVG markup, generated here — no third-party image service
    ever sees a payment URL. */
export async function qrSvg(data: string): Promise<string> {
    return QRCode.toString(data, { type: 'svg', margin: 1, width: 132, color: { dark: '#1c1917', light: '#ffffff' } });
}
