export function useAnalytics() {
    const trackRegistrationConversion = (transactionId = '') => {
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'conversion', {
          'send_to': 'AW-17027457476/XpSUCLLdkL0aEMTDqbc_',
          'transaction_id': transactionId
        });
      }
    };
  
    return { trackRegistrationConversion };
  }