import os
import py_compile
import sys

def check_syntax(directory):
    errors_found = False
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.py'):
                full_path = os.path.join(root, file)
                try:
                    py_compile.compile(full_path, doraise=True)
                except py_compile.PyCompileError as e:
                    print(f"SYNTAX ERROR in {full_path}:")
                    print(e.msg)
                    errors_found = True
                except Exception as e:
                    print(f"ERROR in {full_path}: {e}")
                    errors_found = True
    
    if not errors_found:
        print("No syntax errors found.")

if __name__ == "__main__":
    check_syntax("agents")
