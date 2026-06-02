import React, { cloneElement } from 'react';
import { buttonStyles, mergeButtonStyles } from '../../styles/buttonStyles';
import { ICON_SIZES } from '../../constants/constants';

const Button = ({ 
  variant = 'primary', 
  size = 'default',
  children, 
  className = '', 
  disabled = false,
  loading = false,
  icon,
  iconSize, // Optional manual override
  onClick,
  type = 'button',
  title,
  ...props 
}) => {
  // Determine icon size based on button variant and size
  const getIconSize = () => {
    if (iconSize) return iconSize; // Manual override
    
    // Icon buttons use smaller sizes
    if (variant === 'icon' || variant === 'iconSecondary') {
      return ICON_SIZES.BUTTON_SMALL;
    }
    
    // Compact sizes use default button icon size
    if (size === 'compact') {
      return ICON_SIZES.BUTTON_DEFAULT;
    }
    
    // Large buttons use larger icons
    if (size === 'large') {
      return ICON_SIZES.BUTTON_LARGE;
    }
    
    // Default button icon size
    return ICON_SIZES.BUTTON_DEFAULT;
  };

  // Determine base style based on variant
  const getBaseStyle = () => {
    switch (variant) {
      case 'primary':
        if (size === 'fixed') return buttonStyles.primaryFixed;
        if (size === 'compact') return buttonStyles.primaryCompact;
        return buttonStyles.primary;
      case 'secondary':
        if (size === 'fixed') return buttonStyles.secondaryFixed;
        if (size === 'compact') return buttonStyles.secondaryCompact;
        return buttonStyles.secondary;
      case 'success':
        return size === 'compact' ? buttonStyles.successCompact : buttonStyles.success;
      case 'danger':
        return size === 'compact' ? buttonStyles.dangerCompact : buttonStyles.danger;
      case 'warning':
        return size === 'compact' ? buttonStyles.warningCompact : buttonStyles.warning;
      case 'info':
        return size === 'compact' ? buttonStyles.infoCompact : buttonStyles.info;
      case 'icon':
        return buttonStyles.icon;
      case 'iconSecondary':
        return buttonStyles.iconSecondary;
      case 'languageActive':
        return buttonStyles.languageActive;
      case 'languageInactive':
        return buttonStyles.languageInactive;
      case 'browse':
        return buttonStyles.browse;
      default:
        return buttonStyles.primary;
    }
  };

  const baseStyle = getBaseStyle();
  const disabledStyle = disabled || loading ? 'opacity-50 cursor-not-allowed' : '';
  const finalClassName = mergeButtonStyles(baseStyle, `${disabledStyle} ${className}`);
  const standardIconSize = getIconSize();

  const handleClick = (e) => {
    if (disabled || loading) return;
    onClick?.(e);
  };

  // Clone icon with standardized size if it doesn't already have a size prop
  const renderIcon = () => {
    if (!icon) return null;
    
    try {
      // If icon already has size prop, keep it, otherwise use standard size
      if (icon.props && icon.props.size !== undefined) {
        return icon;
      }
      
      // Clone with standard size
      return cloneElement(icon, { size: standardIconSize });
    } catch (error) {
      // Fallback: return original icon if cloning fails
      console.warn('Failed to standardize icon size:', error);
      return icon;
    }
  };

  return (
    <button
      className={finalClassName}
      onClick={handleClick}
      disabled={disabled || loading}
      type={type}
      title={title}
      {...props}
    >
      {loading ? (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
          {children}
        </div>
      ) : (
        <>
          {icon && <span className="mr-2">{renderIcon()}</span>}
          {children}
        </>
      )}
    </button>
  );
};

export default Button; 