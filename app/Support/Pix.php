<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Pix estático na chave da administração (config/pix.php): monta o código "copia e cola"
 * (BR Code do Banco Central, com CRC16) que também vira o QR Code da página de pagamento.
 */
final class Pix
{
    public static function novoTxid(): string
    {
        return 'WB' . strtoupper(Str::random(14));
    }

    public static function copiaECola(float $valor, string $txid): string
    {
        $c = config('pix');
        $conta = self::campo('00', 'br.gov.bcb.pix') . self::campo('01', (string) $c['chave']);

        $payload = self::campo('00', '01')
            . self::campo('26', $conta)
            . self::campo('52', '0000')
            . self::campo('53', '986')
            . self::campo('54', number_format($valor, 2, '.', ''))
            . self::campo('58', 'BR')
            . self::campo('59', self::texto((string) $c['nome'], 25))
            . self::campo('60', self::texto((string) ($c['cidade'] ?: 'BRASIL'), 15))
            . self::campo('62', self::campo('05', preg_replace('/[^A-Za-z0-9]/', '', $txid) ?: '***'))
            . '6304';

        return $payload . self::crc16($payload);
    }

    private static function campo(string $id, string $valor): string
    {
        return $id . str_pad((string) strlen($valor), 2, '0', STR_PAD_LEFT) . $valor;
    }

    /** Nome e cidade vão sem acento, em maiúsculas e no tamanho que o padrão permite. */
    private static function texto(string $s, int $max): string
    {
        $s = strtoupper(Str::ascii($s));

        return substr(trim(preg_replace('/[^A-Z0-9 ]/', '', $s)), 0, $max);
    }

    /** CRC16-CCITT (polinômio 0x1021, início 0xFFFF). */
    public static function crc16(string $s): string
    {
        $crc = 0xFFFF;
        for ($i = 0, $n = strlen($s); $i < $n; $i++) {
            $crc ^= ord($s[$i]) << 8;
            for ($b = 0; $b < 8; $b++) {
                $crc = ($crc & 0x8000) ? (($crc << 1) ^ 0x1021) : ($crc << 1);
                $crc &= 0xFFFF;
            }
        }

        return strtoupper(str_pad(dechex($crc), 4, '0', STR_PAD_LEFT));
    }
}
