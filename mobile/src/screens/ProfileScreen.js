/**
 * Profile Screen
 * User profile and settings
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

const COLORS = {
  primary: '#6366f1',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  white: '#ffffff',
  gray: '#64748b',
  grayLight: '#f1f5f9',
  text: '#1e293b',
  background: '#f8fafc',
};

// Menu Item Component
function MenuItem({ icon, label, value, onPress, showArrow = true, danger = false }) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.menuIcon, danger && { backgroundColor: `${COLORS.error}15` }]}>
        <Ionicons name={icon} size={20} color={danger ? COLORS.error : COLORS.primary} />
      </View>
      <Text style={[styles.menuLabel, danger && { color: COLORS.error }]}>{label}</Text>
      {value && <Text style={styles.menuValue}>{value}</Text>}
      {showArrow && (
        <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
      )}
    </TouchableOpacity>
  );
}

// Toggle Menu Item
function ToggleMenuItem({ icon, label, value, onValueChange }) {
  return (
    <View style={styles.menuItem}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={20} color={COLORS.primary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: COLORS.grayLight, true: `${COLORS.primary}50` }}
        thumbColor={value ? COLORS.primary : '#f4f3f4'}
      />
    </View>
  );
}

// Section Header
function SectionHeader({ title }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [pushEnabled, setPushEnabled] = React.useState(true);
  const [biometricEnabled, setBiometricEnabled] = React.useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesion',
      '¿Estas seguro que deseas cerrar sesion?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesion',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const handleChangePassword = () => {
    Alert.alert('Cambiar Contrasena', 'Funcionalidad en desarrollo');
  };

  const handleSupport = () => {
    Alert.alert('Soporte', 'Contacta con soporte@stocklogistic.es');
  };

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <TouchableOpacity style={styles.editAvatarButton}>
            <Ionicons name="camera" size={16} color={COLORS.white} />
          </TouchableOpacity>
        </View>
        <Text style={styles.userName}>{user?.name || 'Usuario'}</Text>
        <Text style={styles.userEmail}>{user?.email || 'usuario@email.com'}</Text>
        <View style={styles.roleContainer}>
          <Text style={styles.roleText}>
            {user?.role === 'admin' ? 'Administrador' : 'Agente Aduanero'}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>127</Text>
          <Text style={styles.statLabel}>Expedientes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>89</Text>
          <Text style={styles.statLabel}>Declaraciones</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>98%</Text>
          <Text style={styles.statLabel}>Exito</Text>
        </View>
      </View>

      {/* Menu Sections */}
      <View style={styles.menuSection}>
        <SectionHeader title="Cuenta" />
        <View style={styles.menuGroup}>
          <MenuItem
            icon="person-outline"
            label="Editar Perfil"
            onPress={() => {}}
          />
          <MenuItem
            icon="key-outline"
            label="Cambiar Contrasena"
            onPress={handleChangePassword}
          />
          <MenuItem
            icon="notifications-outline"
            label="Notificaciones"
            onPress={() => navigation.navigate('Notifications')}
          />
        </View>
      </View>

      <View style={styles.menuSection}>
        <SectionHeader title="Preferencias" />
        <View style={styles.menuGroup}>
          <ToggleMenuItem
            icon="notifications"
            label="Push Notifications"
            value={pushEnabled}
            onValueChange={setPushEnabled}
          />
          <ToggleMenuItem
            icon="finger-print"
            label="Acceso Biometrico"
            value={biometricEnabled}
            onValueChange={setBiometricEnabled}
          />
          <MenuItem
            icon="language-outline"
            label="Idioma"
            value="Espanol"
            onPress={() => {}}
          />
        </View>
      </View>

      <View style={styles.menuSection}>
        <SectionHeader title="Aplicacion" />
        <View style={styles.menuGroup}>
          <MenuItem
            icon="help-circle-outline"
            label="Ayuda y Soporte"
            onPress={handleSupport}
          />
          <MenuItem
            icon="document-text-outline"
            label="Terminos y Condiciones"
            onPress={() => {}}
          />
          <MenuItem
            icon="shield-checkmark-outline"
            label="Politica de Privacidad"
            onPress={() => {}}
          />
          <MenuItem
            icon="information-circle-outline"
            label="Version"
            value="1.0.0"
            showArrow={false}
          />
        </View>
      </View>

      <View style={styles.menuSection}>
        <View style={styles.menuGroup}>
          <MenuItem
            icon="log-out-outline"
            label="Cerrar Sesion"
            onPress={handleLogout}
            showArrow={false}
            danger
          />
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>LUCI Customs Agent</Text>
        <Text style={styles.footerSubtext}>Stock Logistic © 2024</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.gray,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 8,
  },
  roleContainer: {
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingVertical: 20,
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: COLORS.grayLight,
    alignSelf: 'center',
  },
  menuSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  menuGroup: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${COLORS.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  menuValue: {
    fontSize: 14,
    color: COLORS.gray,
    marginRight: 8,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.gray,
  },
  footerSubtext: {
    fontSize: 12,
    color: COLORS.grayLight,
    marginTop: 4,
  },
});
