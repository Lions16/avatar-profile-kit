export interface AvatarLabels {
  changePhoto: string;
  removePhoto: string;
  photoAlt: string;
}

export interface ProfileModalLabels extends AvatarLabels {
  logout: string;
  cancel: string;
  save: string;
  saving: string;
  discardTitle: string;
  discardMessage: string;
  discardConfirm: string;
  discardKeepEditing: string;
  installApp: string;
}

export const spanishLabels: ProfileModalLabels = {
  changePhoto: "Cambiar fotografía",
  removePhoto: "Quitar fotografía",
  photoAlt: "Fotografía de perfil",
  logout: "Cerrar sesión",
  cancel: "Cancelar",
  save: "Guardar",
  saving: "Guardando…",
  discardTitle: "Cambios sin guardar",
  discardMessage: "Tienes cambios que todavía no guardaste. ¿Quieres descartarlos?",
  discardConfirm: "Descartar cambios",
  discardKeepEditing: "Seguir editando",
  installApp: "Instalar aplicación",
};

export function mergeLabels(labels?: Partial<ProfileModalLabels>): ProfileModalLabels {
  return { ...spanishLabels, ...labels };
}
