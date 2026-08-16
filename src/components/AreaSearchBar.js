import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function AreaSearchBar({
  areas = [],
  onAreaSelect,
  selectedAreaName = '',
  onChangeText,
  placeholder = 'Select Area...',
  style,
}) {
  const [query, setQuery] = useState(selectedAreaName || '');
  const [isOpen, setIsOpen] = useState(false);

  // Synchronize internal query state with selectedAreaName prop
  useEffect(() => {
    setQuery(selectedAreaName || '');
  }, [selectedAreaName]);

  const safeAreas = Array.isArray(areas) ? areas : [];

  // Filter areas based on current query
  const filteredSuggestions = safeAreas.filter(area => {
    if (!area) return false;
    const name = String(area.area_name || area.name || '').trim();
    if (!query || query.trim().toLowerCase() === String(selectedAreaName).trim().toLowerCase()) return true;
    return name.toLowerCase().includes(query.toLowerCase());
  });

  const handleSelectArea = (area) => {
    const areaName = String(area?.area_name || area?.name || '');
    setQuery(areaName);
    setIsOpen(false);

    if (onChangeText) {
      onChangeText(areaName);
    }
    if (onAreaSelect && area) {
      onAreaSelect(area.id, areaName);
    }
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
    if (onChangeText) {
      onChangeText('');
    }
    if (onAreaSelect) {
      onAreaSelect(null, '');
    }
  };

  const toggleDropdown = () => {
    setIsOpen(prev => !prev);
  };

  return (
    <View style={[styles.container, style, isOpen && styles.containerOpen]}>
      <View style={styles.inputWrapper}>
        <TouchableOpacity
          onPress={toggleDropdown}
          style={styles.iconButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="location-on" size={22} color="#007AFF" />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#8E8E93"
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setIsOpen(true);
            if (onChangeText) {
              onChangeText(text);
            }
          }}
          onFocus={() => setIsOpen(true)}
        />

        <View style={styles.rightActions}>
          {query ? (
            <TouchableOpacity
              onPress={handleClear}
              style={styles.actionIcon}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="cancel" size={20} color="#8E8E93" />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={toggleDropdown}
            style={styles.actionIcon}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons
              name={isOpen ? 'arrow-drop-up' : 'arrow-drop-down'}
              size={26}
              color="#007AFF"
            />
          </TouchableOpacity>
        </View>
      </View>

      {isOpen && (
        <View style={styles.suggestionsContainer}>
          <ScrollView
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled={true}
            style={styles.scrollView}
          >
            {filteredSuggestions.length > 0 ? (
              filteredSuggestions.map((item, index) => {
                const isSelected =
                  String(item.area_name || item.name) === String(selectedAreaName);
                return (
                  <TouchableOpacity
                    key={item.id != null ? String(item.id) : String(index)}
                    style={[
                      styles.suggestionItem,
                      isSelected && styles.selectedItem,
                    ]}
                    onPress={() => handleSelectArea(item)}
                    {...(Platform.OS === 'web'
                      ? {
                          onMouseDown: (e) => {
                            e.preventDefault();
                            handleSelectArea(item);
                          },
                        }
                      : {})}
                  >
                    <MaterialIcons
                      name="location-on"
                      size={18}
                      color={isSelected ? '#007AFF' : '#8E8E93'}
                      style={styles.itemIcon}
                    />
                    <Text
                      style={[
                        styles.suggestionText,
                        isSelected && styles.selectedText,
                      ]}
                    >
                      {item.area_name || item.name}
                    </Text>
                    {isSelected && (
                      <MaterialIcons name="check" size={18} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {safeAreas.length === 0 ? 'Loading or no areas available...' : 'No matching areas found'}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 1000,
    width: '100%',
    position: 'relative',
    marginBottom: 8,
    overflow: 'visible',
    ...Platform.select({
      ios: {
        zIndex: 1000,
      },
      android: {
        elevation: 5,
      },
      web: {
        zIndex: 1000,
      },
    }),
  },
  containerOpen: {
    zIndex: 999999,
    overflow: 'visible',
    ...Platform.select({
      ios: {
        zIndex: 999999,
      },
      android: {
        elevation: 999999,
      },
      web: {
        zIndex: 999999,
      },
    }),
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#007AFF',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    minHeight: 46,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'visible',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginRight: 6,
  },
  searchIcon: {
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    paddingVertical: 8,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  actionIcon: {
    padding: 4,
    marginLeft: 4,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#007AFF',
    borderRadius: 8,
    maxHeight: 240,
    zIndex: 999999,
    elevation: 999999,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    ...Platform.select({
      ios: {
        zIndex: 999999,
      },
      android: {
        elevation: 999999,
      },
      web: {
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        zIndex: 999999,
      },
    }),
  },
  scrollView: {
    maxHeight: 240,
    backgroundColor: '#FFFFFF',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  selectedItem: {
    backgroundColor: '#EBF5FF',
  },
  itemIcon: {
    marginRight: 8,
  },
  suggestionText: {
    fontSize: 15,
    color: '#1C1C1E',
    flex: 1,
    fontWeight: '500',
  },
  selectedText: {
    color: '#007AFF',
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
  },
});
