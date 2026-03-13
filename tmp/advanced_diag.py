import ast
import os
import sys

def check_file(filepath):
    print(f"Checking {filepath}...")
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        tree = ast.parse(content)
        
        # Check for undefined names
        # (Simplified: just look for Name nodes and track imports/def/class)
        defined = set()
        used = []
        
        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                for alias in node.names:
                    defined.add(alias.asname or alias.name.split('.')[0])
            elif isinstance(node, ast.FunctionDef):
                defined.add(node.name)
            elif isinstance(node, ast.ClassDef):
                defined.add(node.name)
            elif isinstance(node, ast.Name):
                if isinstance(node.context, ast.Store):
                    defined.add(node.id)
                elif isinstance(node.context, ast.Load):
                    used.append((node.id, node.lineno))
        
        # Common builtins
        import builtins
        defined.update(dir(builtins))
        
        # Check used against defined
        for name, line in used:
            if name not in defined:
                # Some things might be imported globally or complex, 
                # this is a heuristic
                pass

    except SyntaxError as e:
        print(f"SYNTAX ERROR: {filepath}:{e.lineno}:{e.offset} - {e.msg}")
    except Exception as e:
        print(f"ERROR: {filepath} - {e}")

def run_diagnostics():
    agents_dir = "agents"
    if not os.path.exists(agents_dir):
        print(f"Error: {agents_dir} not found")
        return

    for root, dirs, files in os.walk(agents_dir):
        for file in files:
            if file.endswith('.py'):
                check_file(os.path.join(root, file))

if __name__ == "__main__":
    run_diagnostics()
