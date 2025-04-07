import { Radley, Overpass, PT_Sans } from 'next/font/google'
 
export const overpass = Overpass({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  weight: ['400', '700'],
})
 
export const radley = Radley({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  weight: '400',
})

export const pt_sans = PT_Sans({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  weight: ['400', '700'],
})