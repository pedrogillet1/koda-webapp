const shadows = {
  // Level 0: No shadow (flat)
  none: 'none',

  // Level 1: Subtle shadow (cards, inputs)
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',

  // Level 2: Medium shadow (cards, dropdowns)
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',

  // Level 3: Strong shadow (modals, floating elements)
  lg: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',

  // Level 4: Very strong shadow (help bubble, dialogs)
  xl: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
};

export default shadows;
