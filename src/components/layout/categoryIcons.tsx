"use client";

import {
  Utensils, Car, Home, Heart, ShoppingBag, Plane, Gamepad2, GraduationCap,
  Stethoscope, Dumbbell, Wifi, Zap, Droplet, Building2, Gift, Shirt,
  Coffee, Bus, Film, Briefcase, PiggyBank, DollarSign, CreditCard,
  Wallet, TrendingUp, Receipt, Baby, Dog, Wrench, Fuel, ShieldCheck,
  BookOpen, Music, Phone, Tv, Pizza, Beer, Church, HandCoins, Tag,
  type LucideIcon,
} from "lucide-react";

// Mapa nome → componente lucide. cat_meta.icone guarda o nome (string).
export const ICON_MAP: Record<string, LucideIcon> = {
  Utensils, Car, Home, Heart, ShoppingBag, Plane, Gamepad2, GraduationCap,
  Stethoscope, Dumbbell, Wifi, Zap, Droplet, Building2, Gift, Shirt,
  Coffee, Bus, Film, Briefcase, PiggyBank, DollarSign, CreditCard,
  Wallet, TrendingUp, Receipt, Baby, Dog, Wrench, Fuel, ShieldCheck,
  BookOpen, Music, Phone, Tv, Pizza, Beer, Church, HandCoins, Tag,
};

// Lista para seletores de ícone (Ajustes)
export const ICON_NAMES = Object.keys(ICON_MAP);

export interface CatMeta { chave: string; cor: string; icone: string }

// Retorna o componente do ícone para uma categoria (fallback: Tag)
export function iconeDaCategoria(cat: string, catMeta: CatMeta[]): LucideIcon {
  const meta = catMeta.find(m => m.chave === cat);
  if (meta && ICON_MAP[meta.icone]) return ICON_MAP[meta.icone];
  return Tag;
}

// Retorna a cor da categoria (fallback: paleta por hash)
const PALETA_FALLBACK = ["#2a8a72","#c9952d","#c0492f","#1d5c4f","#3b6ea5","#8a5cb8","#d17b3f","#b8456b","#5a7d3a","#6f7d77"];
export function corDaCategoria(cat: string, catMeta: CatMeta[]): string {
  const meta = catMeta.find(m => m.chave === cat);
  if (meta?.cor) return meta.cor;
  // hash simples para cor estável
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = cat.charCodeAt(i) + ((h << 5) - h);
  return PALETA_FALLBACK[Math.abs(h) % PALETA_FALLBACK.length];
}
