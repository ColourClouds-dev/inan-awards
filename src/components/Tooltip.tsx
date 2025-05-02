import React, { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
  children: ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'top',
  delay = 0.3
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positions = {
    top: { x: 0, y: -8 },
    bottom: { x: 0, y: 8 },
    left: { x: -8, y: 0 },
    right: { x: 8, y: 0 }
  };

  const getPosition = () => {
    return positions[position];
  };

  const getTooltipClass = () => {
    switch (position) {
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2';
      default:
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
    }
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, ...getPosition() }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, ...getPosition() }}
            transition={{ duration: 0.2, delay: delay }}
            className={`absolute z-50 whitespace-nowrap ${getTooltipClass()}`}
          >
            <div className="bg-gray-800 text-white text-xs py-1 px-2 rounded shadow-lg">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Tooltip; 