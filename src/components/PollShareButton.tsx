'use client';

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Modal from './Modal';
import Button from './Button';
import type { Poll } from '../types';

interface PollShareButtonProps {
  poll: Poll;
  tenantDomain: string;
}

export default function PollShareButton({ poll, tenantDomain }: PollShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Construct correct public poll URL
  const getPollUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : `https://${tenantDomain}`;
    return `${origin}/poll/${poll.id}`;
  };

  const pollUrl = getPollUrl();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pollUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const shareText = `Please participate in our poll: ${poll.title}. Vote here: ${pollUrl}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
  const mailtoUrl = `mailto:?subject=${encodeURIComponent(poll.title)}&body=${encodeURIComponent(shareText)}`;

  return (
    <>
      <Button variant="secondary" onClick={() => setIsOpen(true)} fullWidth={false}>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 10.742l4.636-2.318m0 0a3 3 0 102.267-4.053 3 3 0 00-2.267 4.053zm-4.636 2.318A3 3 0 115 13.5a3 3 0 013.684-2.758zm4.636 2.318L8.684 15.258m0 0a3 3 0 102.267 4.053 3 3 0 00-2.267-4.053z" />
          </svg>
          Share Poll
        </span>
      </Button>

      <Modal
        isOpen={isOpen}
        title="Share Voting Link"
        onCancel={() => setIsOpen(false)}
        hideFooter={true}
      >
        <div className="space-y-5 text-center">
          <p className="text-xs sm:text-sm text-gray-500">
            Scan the QR code or copy the link below to share this poll with members.
          </p>

          {/* QR Code Container */}
          <div className="flex justify-center bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-100 w-40 h-40 sm:w-48 sm:h-48 mx-auto items-center">
            <QRCodeSVG value={pollUrl} size={130} />
          </div>

          {/* Link Box */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              readOnly
              value={pollUrl}
              className="flex-1 bg-gray-50 text-gray-600 text-xs px-3 py-2.5 border rounded-lg focus:outline-none truncate"
            />
            <button
              onClick={handleCopy}
              className={`w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-bold text-white transition-colors shrink-0 ${copied ? 'bg-green-600' : 'bg-purple-600 hover:bg-purple-700'}`}
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>

          {/* Share shortcuts */}
          <div className="flex justify-center items-center gap-4 pt-3 border-t text-sm font-semibold">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-green-600 hover:text-green-700 hover:underline py-1 px-2 rounded"
              title="Share on WhatsApp"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.893 3.488"/>
              </svg>
            </a>
            <span className="text-gray-300">|</span>
            <a
              href={mailtoUrl}
              className="inline-flex items-center gap-1.5 text-purple-600 hover:text-purple-700 hover:underline py-1 px-2 rounded"
              title="Share via Email"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
            </a>
          </div>
        </div>
      </Modal>
    </>
  );
}
