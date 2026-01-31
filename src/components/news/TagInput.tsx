import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";

interface TagInputProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({ selectedTags, onTagsChange, placeholder = "Add tags..." }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debouncedInput = useDebounce(inputValue, 200);

  // Fetch all existing tags from articles
  useEffect(() => {
    const fetchTags = async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('tags')
        .not('tags', 'is', null);

      if (error) {
        console.error('Error fetching tags:', error);
        return;
      }

      // Flatten and deduplicate tags
      const tagSet = new Set<string>();
      data?.forEach(article => {
        article.tags?.forEach((tag: string) => {
          if (tag && tag.trim()) {
            tagSet.add(tag.toLowerCase());
          }
        });
      });

      setAllTags(Array.from(tagSet).sort());
    };

    fetchTags();
  }, []);

  // Filter suggestions based on input
  useEffect(() => {
    if (debouncedInput.trim()) {
      const searchTerm = debouncedInput.toLowerCase();
      const filtered = allTags.filter(tag => 
        tag.includes(searchTerm) && !selectedTags.includes(tag)
      ).slice(0, 8); // Limit to 8 suggestions
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
    setHighlightedIndex(-1);
  }, [debouncedInput, allTags, selectedTags]);

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !selectedTags.includes(trimmedTag)) {
      onTagsChange([...selectedTags, trimmedTag]);
      setInputValue("");
      setShowSuggestions(false);
      inputRef.current?.focus();
    }
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(selectedTags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        addTag(suggestions[highlightedIndex]);
      } else if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1]);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 min-h-[44px] p-2 border border-input rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        {selectedTags.map(tag => (
          <Badge
            key={tag}
            variant="secondary"
            className="gap-1 pr-1 h-7"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-1 hover:bg-muted rounded-full p-0.5"
              aria-label={`Remove ${tag} tag`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <div className="relative flex-1 min-w-[120px]">
          <Input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => inputValue && setShowSuggestions(true)}
            placeholder={selectedTags.length === 0 ? placeholder : ""}
            className="border-0 h-7 px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-[200px] overflow-y-auto"
            >
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => addTag(suggestion)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer ${
                    index === highlightedIndex ? 'bg-accent text-accent-foreground' : ''
                  }`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Type to search existing tags or press Enter to create a new one
      </p>
    </div>
  );
}
