import os
import tiktoken  # For tokenizing text

def consolidate_nextjs_files(src_dir='src', output_dir='node_consolidate', main_folders=None):
    """
    Consolidates Next.js/Node.js files for specific main folders within the src directory.
    Creates a consolidated file for each of the specified main folders.
    
    Calculates lines of code and token counts for each folder and the total.
    Adds a summary at the top of each consolidated file about the number of files.
    """
    # If no main folders specified, use these defaults
    if main_folders is None:
        main_folders = ['app', 'components', 'context', 'lib', 'scripts', 'types']
    
    # File extensions to include in consolidation
    extensions = ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.json', '.md']
    
    # Ensure the output directory exists
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Created folder: {output_dir}")

    total_lines_of_code = 0
    total_tokens = 0
    folder_summary = {}  # Store line counts and token counts for each folder
    consolidated_files = []  # List to store paths of all consolidated files

    # Load the GPT tokenizer
    tokenizer = tiktoken.get_encoding("gpt2")

    # Process each main folder separately
    for main_folder in main_folders:
        main_folder_path = os.path.join(src_dir, main_folder)
        
        # Skip if the folder doesn't exist
        if not os.path.exists(main_folder_path) or not os.path.isdir(main_folder_path):
            print(f"Warning: Folder '{main_folder}' does not exist in {src_dir}")
            continue
            
        folder_lines = 0
        folder_tokens = 0
        included_files_count = 0
        
        # Output file for this main folder
        output_file = os.path.join(output_dir, f"{main_folder}_consolidated.txt")
        
        with open(output_file, 'w', encoding='utf-8') as out_file:
            # Write a header for the file (will update file count later)
            out_file.write(f'// Consolidated files from the "{main_folder}" folder\n')
            out_file.write(f'// This file contains all code files within the "{main_folder}" folder and its subfolders.\n\n')
            
            # Walk through the main folder and its subfolders
            for root, dirs, files in os.walk(main_folder_path):
                # Get relative path from src directory
                relative_path = os.path.relpath(root, src_dir)
                
                # Filter files by extension
                included_files = [f for f in files if any(f.endswith(ext) for ext in extensions)]
                included_files_count += len(included_files)
                
                # Skip if no files match our criteria
                if not included_files:
                    continue
                
                # Write files in this subfolder
                for file_name in included_files:
                    file_path = os.path.join(root, file_name)
                    
                    # Get file extension for language identification
                    _, ext = os.path.splitext(file_name)

                    # Write a header indicating the original file
                    out_file.write(f'// Directory: {relative_path}, File: {file_name}\n')
                    out_file.write(f'// File Type: {ext[1:]}\n')  # Remove the dot from extension
                    
                    # Write the contents of the file
                    try:
                        with open(file_path, 'r', encoding='utf-8') as code_file:
                            content = code_file.read()
                            lines = content.splitlines()
                            tokens = len(tokenizer.encode(content))

                            out_file.write('```' + map_extension_to_language(ext) + '\n')
                            out_file.write(content)
                            out_file.write('\n```\n\n')  # Add a blank line for separation

                            folder_lines += len(lines)
                            folder_tokens += tokens
                            print(f"Processed '{relative_path}/{file_name}' ({len(lines)} lines, {tokens} tokens)")
                    except UnicodeDecodeError:
                        out_file.write('// [Binary file or non-UTF-8 encoding, content skipped]\n\n')
                        print(f"Skipped '{relative_path}/{file_name}' (binary or encoding issues)")
        
        # Update the file count in the header
        with open(output_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        content = content.replace(
            f'// Consolidated files from the "{main_folder}" folder', 
            f'// Consolidated {included_files_count} files from the "{main_folder}" folder'
        )
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(content)
                
        # Record this consolidated file
        consolidated_files.append(output_file)
        
        # Update folder summary
        folder_summary[main_folder] = {"lines": folder_lines, "tokens": folder_tokens}
        total_lines_of_code += folder_lines
        total_tokens += folder_tokens
        
        print(f"\nConsolidated {included_files_count} files from '{main_folder}' folder: {output_file}")

    # Create the master consolidated file that includes all individual consolidated files
    master_file_path = os.path.join(output_dir, 'master_consolidated.txt')
    with open(master_file_path, 'w', encoding='utf-8') as master_file:
        # Write the header with the count and list of consolidated file names
        master_file.write(f'// This master file consolidates {len(consolidated_files)} main folders from the src directory.\n')
        master_file.write('// The following folder consolidations are included:\n')
        for cf in consolidated_files:
            master_file.write(f'// - {os.path.basename(cf)}\n')
        master_file.write('\n')
        
        # Add summary statistics
        master_file.write('// Project Statistics:\n')
        master_file.write(f'// - Total lines of code: {total_lines_of_code}\n')
        master_file.write(f'// - Total tokens: {total_tokens}\n\n')

        # Append the content of each consolidated file with a header
        for cf in consolidated_files:
            folder_name = os.path.basename(cf).replace('_consolidated.txt', '')
            master_file.write(f'// ===== Start of {folder_name} folder =====\n\n')
            with open(cf, 'r', encoding='utf-8') as cf_file:
                master_file.write(cf_file.read())
            master_file.write(f'\n// ===== End of {folder_name} folder =====\n\n')

    print(f"\nMaster consolidated file created: {master_file_path}")

    # Print the summary of lines and tokens per folder
    print("\nLines of Code and Token Summary:")
    for folder, stats in folder_summary.items():
        print(f"  Folder '{folder}': {stats['lines']} lines, {stats['tokens']} tokens")
    print(f"Total lines of code: {total_lines_of_code}")
    print(f"Total tokens: {total_tokens}")


def map_extension_to_language(extension):
    """
    Maps file extensions to markdown code block language identifiers.
    """
    extension_map = {
        '.js': 'javascript',
        '.jsx': 'jsx',
        '.ts': 'typescript',
        '.tsx': 'tsx',
        '.css': 'css',
        '.scss': 'scss',
        '.json': 'json',
        '.md': 'markdown',
        '.env': 'plaintext',
        '.gitignore': 'plaintext',
        '.html': 'html',
        '.xml': 'xml',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        # Add more as needed
    }
    
    return extension_map.get(extension.lower(), 'plaintext')


if __name__ == '__main__':
    # Specify the main folders to consolidate
    main_folders = ['app', 'components', 'context', 'lib', 'scripts', 'types']
    consolidate_nextjs_files(main_folders=main_folders)