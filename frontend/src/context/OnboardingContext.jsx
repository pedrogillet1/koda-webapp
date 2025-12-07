import React, { createContext, useContext, useState, useEffect } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAuth } from './AuthContext';
import OnboardingModal from '../components/onboarding/OnboardingModal';

const OnboardingContext = createContext();

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};

export const OnboardingProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [source, setSource] = useState(null); // 'auto' | 'settings'
  const isMobile = useIsMobile();
  const { isAuthenticated } = useAuth();

  /**
   * Open the onboarding modal
   * @param {number} startStep - Step to start at (0-2)
   * @param {string} triggerSource - Where the modal was triggered from ('auto' | 'settings')
   */
  const open = (startStep = 0, triggerSource = 'auto') => {
    // Desktop-only restriction
    if (isMobile || (typeof window !== 'undefined' && window.innerWidth < 1024)) {
      console.log('⏭️ [OnboardingContext] Skipping onboarding - mobile device');
      return;
    }

    console.log(`🚀 [OnboardingContext] Opening onboarding - step ${startStep}, source: ${triggerSource}`);
    setCurrentStep(startStep);
    setSource(triggerSource);
    setIsOpen(true);
  };

  /**
   * Close the onboarding modal
   * @param {boolean} markCompleted - Whether to mark onboarding as completed
   */
  const close = (markCompleted = true) => {
    console.log(`🔒 [OnboardingContext] Closing onboarding - markCompleted: ${markCompleted}`);

    if (markCompleted) {
      localStorage.setItem('koda_onboarding_completed', 'true');
    }

    setIsOpen(false);
    setCurrentStep(0);
    setSource(null);
  };

  /**
   * Navigate to a specific step
   * @param {number} step - Step index (0-2)
   */
  const goToStep = (step) => {
    if (step >= 0 && step <= 2) {
      setCurrentStep(step);
    }
  };

  /**
   * Go to next step or complete if on last step
   */
  const next = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    } else {
      close(true);
    }
  };

  /**
   * Go to previous step
   */
  const back = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  /**
   * Skip onboarding (marks as completed)
   */
  const skip = () => {
    close(true);
  };

  const value = {
    isOpen,
    currentStep,
    source,
    open,
    close,
    goToStep,
    next,
    back,
    skip
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {/* Render the modal at root level so it overlays any page */}
      {isOpen && (
        <OnboardingModal
          currentStep={currentStep}
          onNext={next}
          onBack={back}
          onSkip={skip}
          onComplete={() => close(true)}
          onGoToStep={goToStep}
        />
      )}
    </OnboardingContext.Provider>
  );
};
