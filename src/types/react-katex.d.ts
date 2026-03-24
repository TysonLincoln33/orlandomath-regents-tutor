// src/types/react-katex.d.ts

declare module "react-katex" {
    import * as React from "react";
  
    export interface KaTeXBaseProps {
      children?: string;
      math?: string;
      errorColor?: string;
      renderError?: (error: Error) => React.ReactNode;
      settings?: Record<string, unknown>;
    }
  
    export interface InlineMathProps extends KaTeXBaseProps {
      as?: keyof JSX.IntrinsicElements;
    }
  
    export interface BlockMathProps extends KaTeXBaseProps {
      as?: keyof JSX.IntrinsicElements;
    }
  
    export const InlineMath: React.FC<InlineMathProps>;
    export const BlockMath: React.FC<BlockMathProps>;
  }
  