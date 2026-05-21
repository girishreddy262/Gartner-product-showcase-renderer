import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import type { CustomerCardOverlay } from '../types';
import { resolveCustomerLogoById } from '../customer-logos';
import { resolveCustomerLogo as resolveCustomerLogoUrl } from '../embedded-logos';

/**
 * v3.28b.1 Patch 1 — Customer Card overlay (full redesign).
 *
 * Card spec:
 *   - Width: 388 (fixed)
 *   - Height: auto-grows with body text. Min 400. 40px gap from last text line to bottom.
 *   - White background, 2px #0183FF border, 20px corner radius
 *   - Drop shadow: #0183FF @ 30% opacity, x=8, y=8, blur=0 (sharp blue offset)
 *   - Stats band: #ECF6FF, X=2..336 (insets right ~50px), Y=123..246
 *   - Icons: 3 path-based icons from Union.svg / Union-1.svg / Union-2.svg (designer-provided)
 *   - Stats text: Satoshi Bold 16, color #1F2431, positioned 13px right of each icon
 *   - Body text: width 300px, Satoshi Medium 16px, color #1F2431
 *   - Body supports newlines and bullet lines (lines starting with `-` or `•`)
 *
 * Animations (v3.28b.1): same-side bounce — slide-right (in from right, out to right)
 * OR slide-left (in from left, out to left). Old fade/scale still work for back-compat.
 */
export const CustomerCardComp: React.FC<{
  card: CustomerCardOverlay;
  startFrame: number;
  durationFrames: number;
}> = ({ card, startFrame, durationFrames }) => {
  const localFrame = useCurrentFrame();

  const animInDur = Math.max(1, Math.round((card.animInAt || 0.3) * 30));
  const animOutDur = Math.max(1, Math.round((card.animOutAt || 0.3) * 30));
  const outStart = Math.max(0, durationFrames - animOutDur);

  let opacity = 1;
  let translateY = 0;
  let translateX = 0;

  // ─── IN animations (v3.28b.17: standardized to FADE by default) ───
  if (localFrame < animInDur) {
    if (card.animIn === 'slide-left') {
      // Slide in from left edge → resting position
      opacity = interpolate(localFrame, [0, animInDur], [0, 1], { extrapolateRight: 'clamp' });
      translateX = interpolate(localFrame, [0, animInDur], [-200, 0], {
        extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
      });
    } else if (card.animIn === 'slide-right') {
      // Slide in from right edge
      opacity = interpolate(localFrame, [0, animInDur], [0, 1], { extrapolateRight: 'clamp' });
      translateX = interpolate(localFrame, [0, animInDur], [200, 0], {
        extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
      });
    } else if (card.animIn === 'fade-up') {
      opacity = interpolate(localFrame, [0, animInDur], [0, 1], { extrapolateRight: 'clamp' });
      translateY = interpolate(localFrame, [0, animInDur], [30, 0], {
        extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
      });
    } else {
      // Default: pure FADE (v3.28b.17 standard)
      opacity = interpolate(localFrame, [0, animInDur], [0, 1], { extrapolateRight: 'clamp' });
    }
  }

  // ─── OUT animations (v3.28b.17: standardized to FADE by default) ───
  if (localFrame >= outStart) {
    if (card.animOut === 'slide-left' || card.animOut === 'slide-out-left') {
      opacity = interpolate(localFrame, [outStart, durationFrames], [1, 0], { extrapolateLeft: 'clamp' });
      translateX = interpolate(localFrame, [outStart, durationFrames], [0, -200], {
        extrapolateLeft: 'clamp', easing: Easing.in(Easing.cubic),
      });
    } else if (card.animOut === 'slide-right') {
      opacity = interpolate(localFrame, [outStart, durationFrames], [1, 0], { extrapolateLeft: 'clamp' });
      translateX = interpolate(localFrame, [outStart, durationFrames], [0, 200], {
        extrapolateLeft: 'clamp', easing: Easing.in(Easing.cubic),
      });
    } else {
      // Default: pure FADE (v3.28b.17 standard)
      opacity = interpolate(localFrame, [outStart, durationFrames], [1, 0], { extrapolateLeft: 'clamp' });
    }
  }

  // Resolve logo: prefer customerLogoId, fall back to logoUrl, fall back to legacy resolver
  const resolvedLogo =
    resolveCustomerLogoById(card.customerLogoId) ||
    resolveCustomerLogoUrl(card.logoUrl);

  return (
    <div
      style={{
        position: 'absolute',
        left: card.x,
        top: card.y,
        transform: `translate(${translateX}px, ${translateY}px)`,
        opacity,
        pointerEvents: 'none',
      }}
    >
      <CustomerCardSvg
        logoUrl={resolvedLogo || undefined}
        employees={card.employees}
        industry={card.industry}
        location={card.location}
        body={card.body}
      />
    </div>
  );
};

/**
 * Pure renderer for the v3.28b.1 card design.
 */
export const CustomerCardSvg: React.FC<{
  logoUrl?: string;
  employees: string;
  industry: string;
  location: string;
  body: string;
}> = ({ logoUrl, employees, industry, location, body }) => {
  return (
    <div
      style={{
        // Card outer wrapper — 388 wide, auto height
        position: 'relative',
        width: 388,
        // Drop shadow per spec: #0183FF @ 30% opacity, x=8 y=8 blur=0
        filter: 'drop-shadow(8px 8px 0 rgba(1, 131, 255, 0.3))',
      }}
    >
      <div
        style={{
          // The card itself — white bg, blue border, rounded corners, auto height
          position: 'relative',
          background: '#FFFFFF',
          border: '2px solid #0183FF',
          borderRadius: 20,
          minHeight: 400,
          overflow: 'hidden',
        }}
      >
        {/* Logo area — left-aligned in top region */}
        <div style={{
          position: 'relative',
          height: 76,
          margin: '30px 30px 14px 30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              style={{
                maxWidth: 200,
                maxHeight: '100%',
                objectFit: 'contain',
                objectPosition: 'left center',
              }}
            />
          ) : (
            <div style={{
              fontFamily: "'Satoshi', sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: '#999',
            }}>
              Logo
            </div>
          )}
        </div>

        {/* Stats band — light blue, inset right ~52px to match design */}
        <div style={{
          position: 'relative',
          height: 123,
          background: '#ECF6FF',
          marginRight: 52,
          borderTopRightRadius: 12,
          borderBottomRightRadius: 12,
        }}>
          {/* People icon (Union.svg — group of 3 figures, 24×16) */}
          <svg width={24} height={16} viewBox="0 0 24 16" fill="none"
               style={{ position: 'absolute', left: 41, top: 32 }}>
            <path d="M12.2227 7.41011C12.2227 6.86811 15.6133 8.06584 16.5791 8.94918C16.9817 9.31727 17.1817 9.34689 18.0176 9.15914C19.2717 8.87743 19.2542 8.83865 18.8389 10.9755C18.4071 13.1964 18.8299 14.1837 19.7979 13.2158C20.2572 12.7564 20.2584 12.7288 19.8906 10.9257C19.4553 8.79139 19.4473 8.81018 20.7002 9.14351C23.2279 9.81573 23.9979 10.8652 23.999 13.6377L24 15.582H0L0.000976562 13.6377C0.00211276 10.8652 0.772145 9.81573 3.2998 9.14351C4.55267 8.81018 4.54469 8.79139 4.10938 10.9257C3.7416 12.7288 3.74282 12.7564 4.20215 13.2158C5.1701 14.1837 5.5929 13.1964 5.16113 10.9755C4.74584 8.83865 4.72833 8.87743 5.98242 9.15914C6.81763 9.34689 7.01858 9.31732 7.4209 8.95015C7.94334 8.47349 9.15213 7.8249 9.99902 7.56734C10.5858 7.38898 11.7773 7.30397 11.7773 7.44039C11.7769 7.48671 11.5682 8.54893 11.3125 9.80269L10.8467 12.0859L12 13.2392L13.1533 12.0859L12.6875 9.80269C12.4317 8.54818 12.2229 7.47189 12.2227 7.41011ZM3.11133 3.62593C4.97216 2.36363 7.49373 3.83206 7.28027 6.05367C6.98361 9.14122 2.98066 9.55406 2.00488 6.59761C1.65823 5.54717 2.12423 4.29571 3.11133 3.62593ZM18.3154 3.35347C20.7483 2.36943 23.1622 5.2235 21.6484 7.2939C20.4884 8.88045 18.452 9.00409 17.2383 7.56148C16.1481 6.26593 16.7299 3.99503 18.3154 3.35347ZM10.2197 0.526324C12.033 -0.707857 14.7018 0.339063 15.291 2.51558C15.9137 4.81595 13.6338 7.31289 11.3975 6.78023C8.24125 6.02779 7.54731 2.345 10.2197 0.526324Z" fill="#0183FF" fillOpacity="0.8"/>
          </svg>
          {/* Industry icon (Union-1.svg — briefcase, 23×20) */}
          <svg width={23} height={20} viewBox="0 0 23 20" fill="none"
               style={{ position: 'absolute', left: 152, top: 30 }}>
            <path d="M0.807617 11.9282C0.830289 11.9295 1.04489 12.0332 1.28613 12.1597C1.94795 12.5065 2.41899 12.6016 3.78613 12.6606L5.03027 12.7134L5.07324 13.2895C5.19805 14.9391 7.02762 14.9585 7.10254 13.311L7.12988 12.6929H15.6523L15.7031 13.2339C15.8655 14.9788 17.7363 15.0013 17.7373 13.2583L17.7383 12.7153L19.0449 12.6606C20.4458 12.6023 20.9837 12.4899 21.6299 12.1177C22.1211 11.8347 22.1063 11.7243 22.0801 15.6089C22.0535 19.5474 22.0731 19.4007 21.5361 19.728C21.1667 19.9433 1.78443 19.9641 1.32617 19.7495C0.778078 19.4894 0.773395 19.4561 0.771484 15.4634C0.770567 13.5193 0.78721 11.9282 0.807617 11.9282ZM16.3789 10.6714C16.6164 10.505 16.8945 10.5239 17.1025 10.7192C17.3601 10.9619 17.3802 13.6473 17.126 13.8784C16.9081 14.0756 16.5245 14.0581 16.3506 13.8433C16.1138 13.5505 16.1379 10.8409 16.3789 10.6714ZM5.75488 10.6714C5.99236 10.505 6.27047 10.5239 6.47852 10.7192C6.65522 10.8863 6.76086 13.3234 6.6084 13.7212C6.48672 14.0381 6.01508 14.1085 5.71875 13.854C5.48724 13.6536 5.51906 10.8369 5.75488 10.6714ZM8.13281 0.0766505C8.79999 -0.0875175 14.7812 0.0360725 15.1279 0.221182C16.0897 0.734528 16.448 1.41061 16.498 2.80419L16.5342 3.80712L19.0664 3.84423C22.9291 3.90124 22.8782 3.85447 22.8428 7.32274L22.8213 9.52099L22.5771 10.0366C22.2526 10.7216 21.7117 11.2535 21.0049 11.5845L20.4512 11.8433L19.1143 11.8667L17.7764 11.8901L17.7383 11.2534C17.6357 9.54754 15.8455 9.63589 15.7002 11.354L15.6523 11.9302L11.4023 11.9097L7.15234 11.8901L7.11328 11.3169C7.05478 10.4551 6.76896 10.0943 6.14453 10.0942C5.4318 10.0942 5.16384 10.4007 5.08496 11.3052L5.03027 11.9282L4.18066 11.9253C1.93883 11.9164 0.948573 11.4391 0.259766 10.0366L0.0439453 9.59716L0.0214844 7.29833L0 5.00048L0.250977 4.62938C0.728913 3.92556 0.791668 3.91179 3.7627 3.85692L6.33496 3.81005L6.36328 2.76708C6.4048 1.23552 6.98045 0.36027 8.13281 0.0766505ZM11.5732 1.61962C8.32258 1.63032 8.04892 1.58152 8.03125 2.50048V3.82665H14.834V3.02782C14.834 2.14227 14.7694 1.92516 14.4521 1.73778C14.2614 1.62522 13.9304 1.61183 11.5732 1.61962Z" fill="#0183FF" fillOpacity="0.8"/>
          </svg>
          {/* Location icon (Union-2.svg — globe + pin, 22×24) */}
          <svg width={22} height={24} viewBox="0 0 22 24" fill="none"
               style={{ position: 'absolute', left: 41, top: 70 }}>
            <path d="M10.5105 3.46527C10.8615 3.4743 10.9651 3.5937 10.9138 3.94281C10.8663 4.26571 10.8654 4.58866 10.8787 4.91156C10.8853 5.07684 10.8387 5.18385 10.6853 5.24749C10.6207 5.27455 10.5578 5.31323 10.5037 5.35785C10.3792 5.46044 10.3936 5.59102 10.5437 5.65277C10.6368 5.69123 10.7423 5.71527 10.8425 5.71527C10.9617 5.71528 11.0066 5.76749 11.0417 5.87054C11.094 6.02481 11.0601 6.08909 10.8884 6.08539C10.5488 6.07779 10.2085 6.08531 9.86889 6.08246C9.66292 6.08063 9.50753 6.14854 9.40404 6.34222C9.22163 6.68359 8.90448 6.81631 8.53881 6.83246C8.05639 6.85332 7.57398 6.83459 7.10912 6.68597C6.93168 6.62962 6.7748 6.64081 6.61108 6.73382C6.08913 7.03008 5.49871 7.06964 4.92455 7.16937C4.80018 7.19073 4.67585 7.21274 4.55053 7.22699C4.04185 7.28541 3.63436 7.48851 3.33276 7.93304C3.04539 8.3572 2.73013 8.76342 2.44799 9.19281C2.32757 9.37637 2.3869 9.45401 2.56322 9.52093C2.76404 9.59689 2.9713 9.57843 3.1726 9.55707C3.75303 9.49484 4.3333 9.42484 4.91088 9.34124C5.17563 9.30289 5.37028 9.35301 5.50463 9.60394C5.58582 9.75587 5.69947 9.89159 5.80346 10.0307C6.27132 10.6567 6.4429 11.3618 6.34838 12.1313C6.3276 12.3011 6.37036 12.4476 6.45483 12.5805C6.8025 13.1277 7.19324 13.644 7.59838 14.1498C7.65486 14.2206 7.72795 14.331 7.81811 14.3061C7.9112 14.28 7.85232 14.1525 7.87084 14.0717C7.88824 13.9962 7.88671 13.915 7.94897 13.8432C8.04698 13.8926 8.05951 13.9724 8.08178 14.0473C8.23995 14.5817 8.60766 14.9019 9.14818 14.9594C9.70942 15.0193 10.1801 15.2124 10.5671 15.6274C10.7176 15.7887 10.9244 15.8856 11.1228 15.9838C11.3104 16.0764 11.344 16.2131 11.2576 16.395C11.1493 16.6229 11.0447 16.8527 10.9421 17.0834C10.8457 17.3009 10.864 17.5087 10.9841 17.7172C11.3727 18.3931 11.6259 19.1235 11.824 19.8744C11.897 20.1508 11.8786 20.4184 11.8064 20.6918C11.6564 21.2564 11.5142 21.8219 11.5222 22.4145C11.5251 22.623 11.583 22.7031 11.7966 22.6537C12.0577 22.5935 12.3222 22.5501 12.5847 22.4946C12.6368 22.4837 12.7039 22.4629 12.7312 22.4243C12.9734 22.077 13.3585 21.9288 13.7009 21.7241C14.1982 21.4272 14.5458 21.0136 14.7078 20.4575C14.797 20.1511 14.9685 19.9585 15.28 19.8559C15.7963 19.6863 16.1484 19.3191 16.3669 18.8285C16.5336 18.4534 16.6875 18.0716 16.904 17.7211C16.9966 17.5711 16.9757 17.4564 16.8191 17.3666C16.4975 17.1819 16.1745 16.9984 15.8581 16.8051C15.4645 16.5648 15.1103 16.2738 14.824 15.9106C14.6297 15.6641 14.3995 15.5129 14.0808 15.4535C13.624 15.3681 13.1767 15.2367 12.7156 15.1645C12.3798 15.1118 12.0535 15.1823 11.7234 15.1899C11.4313 15.1965 11.1797 15.1338 10.9646 14.9291C10.8502 14.8209 10.726 14.7205 10.5964 14.6313C10.4523 14.5316 10.3961 14.4013 10.3904 14.2299C10.3798 13.9116 10.2107 13.8182 9.9226 13.9662C9.8466 14.0052 9.78344 14.0692 9.71361 14.1196C9.66052 14.158 9.62991 14.2571 9.54565 14.2143C9.47825 14.1801 9.47948 14.0946 9.47143 14.0239C9.46812 13.9927 9.46165 13.9613 9.45971 13.9301C9.44831 13.7411 9.34959 13.5368 9.56615 13.3901C9.82312 13.2162 10.0843 13.0751 10.4021 13.2309C10.5868 13.3216 10.7729 13.4045 10.9695 13.4672C11.1424 13.5223 11.245 13.4685 11.3015 13.3051C11.6915 12.173 12.5799 11.5184 13.5554 10.9438C13.7499 10.8295 13.8793 10.8632 14.0183 11.0375C14.4064 11.5258 14.7469 12.0539 15.1863 12.4994C16.0579 13.3834 17.3724 13.3127 18.1599 12.3461C18.689 11.6969 19.1938 11.0285 19.6716 10.3403C19.747 10.2316 19.8141 10.0968 19.9783 10.1186C20.1484 10.1416 20.1948 10.2828 20.2351 10.4233C21.42 14.5588 20.5303 18.1816 17.4568 21.1967C15.7668 22.8544 13.6786 23.7556 11.3113 23.9584C8.40139 24.2076 5.83164 23.3588 3.61889 21.4682C1.66861 19.8024 0.482987 17.6828 0.111076 15.144C-0.665889 9.84235 2.71016 4.8866 7.82983 3.71332C8.71187 3.51097 9.60755 3.44152 10.5105 3.46527ZM15.866 0.0717135C18.1756 -0.359829 20.4819 1.20312 20.9822 3.49945C21.2216 4.59903 20.9183 5.57516 20.4499 6.53558C19.8239 7.8185 19.03 8.99798 18.1921 10.1489C17.8669 10.5956 17.5325 11.0362 17.1902 11.4702C16.88 11.8634 16.375 11.8797 16.0701 11.4926C14.8214 9.90914 13.6292 8.28562 12.7458 6.46136C12.4499 5.85006 12.1915 5.21921 12.1677 4.52289C12.1658 4.46797 12.1609 4.4131 12.1599 4.39593C12.2706 2.16684 13.738 0.469274 15.866 0.0717135ZM11.5203 7.05121C11.6043 7.03506 11.6108 7.12295 11.6374 7.17425C11.7571 7.40497 11.8742 7.63742 11.9919 7.86957C12.0228 7.93084 12.0822 8.00967 11.9744 8.04339C11.7782 8.10575 11.7531 8.2688 11.7156 8.43109C11.6909 8.53837 11.6592 8.64509 11.6355 8.75238C11.6069 8.87895 11.5216 8.95099 11.4021 8.94867C11.1902 8.94439 10.975 8.94026 10.7712 8.86664C10.5944 8.80217 10.5241 8.6725 10.5154 8.50726V8.43499C10.5088 8.26888 10.5665 8.13652 10.7322 8.0805C11.1544 7.93753 11.4162 7.67237 11.4324 7.20453C11.4343 7.14529 11.448 7.0657 11.5203 7.05121ZM16.6746 1.70746C15.1775 1.66328 13.8533 2.93229 13.866 4.43597C13.8546 5.92362 15.0938 7.17697 16.5876 7.18695C18.0713 7.19736 19.3241 5.95498 19.3367 4.46234C19.3485 2.98135 18.1313 1.7507 16.6746 1.70746ZM7.97924 5.14105C7.7674 5.1539 7.46992 5.39803 7.4685 5.54242C7.46815 5.67857 7.72553 5.8135 8.04955 5.81683C8.30937 5.78928 8.60861 5.68919 8.90404 5.57757C8.99165 5.5443 9.01464 5.46425 8.99291 5.38128C8.96916 5.29104 8.9386 5.16813 8.82983 5.17621C8.54346 5.19707 8.26276 5.12395 7.97924 5.14105Z" fill="#0183FF" fillOpacity="0.8"/>
          </svg>

          {/* Stat labels — 13px right of each icon */}
          <div style={{
            position: 'absolute', left: 78, top: 32, height: 16,
            display: 'flex', alignItems: 'center',
            color: '#1F2431', fontFamily: "'Satoshi', sans-serif",
            fontWeight: 700, fontSize: 16, lineHeight: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: 80,
          }}>{employees || ''}</div>
          <div style={{
            position: 'absolute', left: 188, top: 30, height: 20,
            display: 'flex', alignItems: 'center',
            color: '#1F2431', fontFamily: "'Satoshi', sans-serif",
            fontWeight: 700, fontSize: 16, lineHeight: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: 130,
          }}>{industry || ''}</div>
          <div style={{
            position: 'absolute', left: 76, top: 70, height: 24,
            display: 'flex', alignItems: 'center',
            color: '#1F2431', fontFamily: "'Satoshi', sans-serif",
            fontWeight: 700, fontSize: 16, lineHeight: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: 260,
          }}>{location || ''}</div>
        </div>

        {/* Body — 22px top gap to stats band, 40px bottom gap to card edge */}
        <div style={{ padding: '22px 30px 40px 30px' }}>
          <CustomerCardBody body={body} />
        </div>
      </div>
    </div>
  );
};

/**
 * Body text renderer with bullet support.
 */
const CustomerCardBody: React.FC<{ body: string }> = ({ body }) => {
  const lines = (body || '').split('\n');

  const blocks: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];
  const flushBullets = () => {
    if (bulletBuffer.length > 0) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} style={{ margin: 0, paddingLeft: 20 }}>
          {bulletBuffer.map((b, i) => (
            <li key={i} style={{ marginBottom: 4 }}>{b}</li>
          ))}
        </ul>
      );
      bulletBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^\s*[-•]\s+(.*)$/);
    if (m) {
      bulletBuffer.push(m[1]);
    } else {
      flushBullets();
      if (line.trim() === '') {
        blocks.push(<br key={`br-${i}`} />);
      } else {
        blocks.push(<div key={`p-${i}`}>{line}</div>);
      }
    }
  }
  flushBullets();

  return (
    <div style={{
      width: 300,
      color: '#1F2431',
      fontFamily: "'Satoshi', sans-serif",
      fontWeight: 500,
      fontSize: 16,
      lineHeight: 1.45,
      wordWrap: 'break-word',
    }}>
      {blocks}
    </div>
  );
};
