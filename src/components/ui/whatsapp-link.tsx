import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WhatsAppLinkProps {
  phone: string;
  message?: string;
  className?: string;
  iconSize?: string;
}

function normalizeToWhatsApp(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);
  if (cleaned.startsWith('0')) cleaned = '+971' + cleaned.slice(1);
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
  return cleaned;
}

export function WhatsAppLink({ phone, message, className, iconSize = 'h-4 w-4' }: WhatsAppLinkProps) {
  const normalized = normalizeToWhatsApp(phone);
  const url = `https://wa.me/${normalized.replace('+', '')}${message ? `?text=${encodeURIComponent(message)}` : ''}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('inline-flex items-center text-green-600 hover:text-green-700 transition-colors', className)}
      title="Chat on WhatsApp"
      onClick={e => e.stopPropagation()}
    >
      <MessageCircle className={cn(iconSize, 'fill-current')} />
    </a>
  );
}
