#!/usr/bin/env python3
"""
Consolidate all files of a specific extension into a single file.
Usage: python consolidate_code.py <extension> [output_dir]
Example: python consolidate_code.py tsx
         python consolidate_code.py py ./output
"""

import os
import sys
from pathlib import Path


def consolidate_files(extension: str, output_dir: str = ".") -> None:
    """
    Find all files with given extension and consolidate into one file.
    
    Args:
        extension: File extension to search for (e.g., 'tsx', 'py', 'html')
        output_dir: Directory to save consolidated file (default: current directory)
    """
    # Normalize extension
    extension = extension.lstrip('.')
    
    # Get script directory as base search path
    script_dir = Path(__file__).parent.resolve()
    output_path = Path(output_dir).resolve()
    
    # Ensure output directory exists
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Find all matching files
    matching_files = []
    for root, dirs, files in os.walk(script_dir):
        # Skip common exclusion directories
        dirs[:] = [d for d in dirs if d not in {'.git', '__pycache__', 'node_modules', '.venv', 'venv', 'dist', 'build'}]
        
        for file in files:
            if file.endswith(f'.{extension}'):
                full_path = Path(root) / file
                matching_files.append(full_path)
    
    if not matching_files:
        print(f"No files found with extension .{extension}")
        return
    
    # Sort files for consistent output
    matching_files.sort()
    
    # Create output file
    output_file = output_path / f"consolidate_{extension}.txt"
    
    with open(output_file, 'w', encoding='utf-8') as out:
        out.write(f"# Consolidated {extension.upper()} Files\n")
        out.write(f"# Total files: {len(matching_files)}\n")
        out.write(f"# Generated: {os.path.getmtime(output_file)}\n")
        out.write("=" * 80 + "\n\n")
        
        for file_path in matching_files:
            # Get relative path from script directory
            rel_path = file_path.relative_to(script_dir)
            
            out.write(f"\n{'=' * 80}\n")
            out.write(f"# File: {rel_path}\n")
            out.write(f"{'=' * 80}\n\n")
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    out.write(content)
                    
                    # Ensure newline at end of file
                    if content and not content.endswith('\n'):
                        out.write('\n')
            except UnicodeDecodeError:
                out.write(f"# [BINARY FILE - SKIPPED]\n")
            except Exception as e:
                out.write(f"# [ERROR READING FILE: {e}]\n")
            
            out.write("\n")
    
    print(f"Consolidated {len(matching_files)} .{extension} files into: {output_file}")
    print(f"File size: {output_file.stat().st_size:,} bytes")


def main():
    if len(sys.argv) < 2:
        print("Usage: python consolidate_code.py <extension> [output_dir]")
        print("Example: python consolidate_code.py tsx")
        print("         python consolidate_code.py py ./output")
        sys.exit(1)
    
    extension = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "."
    
    consolidate_files(extension, output_dir)


if __name__ == "__main__":
    main()
