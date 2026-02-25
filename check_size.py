import os

def get_dir_size(path):
    total = 0
    try:
        with os.scandir(path) as it:
            for entry in it:
                if entry.is_file():
                    total += entry.stat().st_size
                elif entry.is_dir():
                    total += get_dir_size(entry.path)
    except Exception as e:
        print(f"Error reading {path}: {e}")
    return total

if __name__ == "__main__":
    target = r"dist\SistemaDepilarte"
    size = get_dir_size(target)
    print(f"Total size of {target}: {size / 1024 / 1024:.2f} MB")
