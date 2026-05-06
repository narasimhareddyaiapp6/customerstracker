import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';

export default function AreaSearchBar({ areas, onAreaSelect, selectedAreaName, onChangeText, style }) {
  const [query, setQuery] = useState(selectedAreaName || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setQuery(selectedAreaName || '');
  }, [selectedAreaName]);

  const handleInputChange = (text) => {
    setQuery(text);
    if (onChangeText) {
      onChangeText(text);
    }
  };

  useEffect(() => {
    if (query && isFocused) {
      const filteredAreas = areas.filter(area =>
        area.area_name.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(filteredAreas);
    } else if (isFocused && !query) {
      setSuggestions(areas);
    } else {
      setSuggestions([]);
    }
  }, [query, areas, isFocused]);

  const handleSelectArea = (area) => {
    setQuery(area.area_name);
    setSuggestions([]);
    setIsFocused(false);
    onAreaSelect(area.id, area.area_name);
  };

  return (
    <View style={[styles.container, style]}>
      <TextInput
        style={styles.input}
        placeholder="Search Area..."
        value={query}
        onChangeText={handleInputChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          // Use timeout to allow onPress to register before hiding
          setTimeout(() => setIsFocused(false), 200);
        }}
      />
      {suggestions.length > 0 && isFocused && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={suggestions}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => handleSelectArea(item)}
              >
                <Text style={styles.suggestionText}>{item.area_name}</Text>
              </TouchableOpacity>
            )}
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled={true}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 5000, // Very high zIndex for the whole component
    width: '100%',
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
    fontSize: 16,
    zIndex: 5001,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%', // Position exactly below the input
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF', // Solid white background
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    maxHeight: 250,
    zIndex: 9999, // Absolute highest zIndex
    elevation: 10,
    marginTop: 2, // Small gap
    ...Platform.select({
      web: {
        boxShadow: '0px 8px 16px rgba(0,0,0,0.2)', // Stronger shadow for web
      },
    }),
  },
  suggestionItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    backgroundColor: '#FFFFFF',
  },
  suggestionText: {
    fontSize: 16,
    color: '#1C1C1E',
  },
});
