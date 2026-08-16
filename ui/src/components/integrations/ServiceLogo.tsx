import * as React from 'react';

export type ServiceLogoId =
  | 'google'
  | 'gmail'
  | 'outlook'
  | 'icloud-mail'
  | 'yahoo-mail'
  | 'google-drive'
  | 'google-calendar'
  | 'github'
  | 'gitlab'
  | 'slack'
  | 'notion'
  | 'linear';

const SERVICE_NAMES: Record<ServiceLogoId, string> = {
  google: 'Google',
  gmail: 'Gmail',
  outlook: 'Outlook',
  'icloud-mail': 'iCloud Mail',
  'yahoo-mail': 'Yahoo Mail',
  'google-drive': 'Google Drive',
  'google-calendar': 'Google Calendar',
  github: 'GitHub',
  gitlab: 'GitLab',
  slack: 'Slack',
  notion: 'Notion',
  linear: 'Linear',
};

interface ServiceLogoProps extends Omit<React.ComponentProps<'img'>, 'src' | 'width' | 'height'> {
  service: ServiceLogoId;
  size?: number;
  decorative?: boolean;
}

export function ServiceLogo({ service, size = 24, decorative = true, alt, className, ...props }: ServiceLogoProps) {
  return (
    <img
      {...props}
      className={`service-logo${className ? ` ${className}` : ''}`}
      data-service={service}
      src={`/brand/apps/${service}.svg`}
      width={size}
      height={size}
      alt={decorative ? '' : (alt ?? SERVICE_NAMES[service])}
      aria-hidden={decorative ? true : undefined}
    />
  );
}
