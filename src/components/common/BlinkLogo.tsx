import typewriterSvg from '../../assets/BlinkCode-typewriter.svg';

export default function BlinkLogo({ className }: { className?: string }) {
  return <object type="image/svg+xml" data={typewriterSvg} className={className} aria-label="BlinkCode" style={{ pointerEvents: 'none', display: 'block' }} />;
}
