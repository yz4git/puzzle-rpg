#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
source_dir="$project_dir/public/assets/rpg/source"
atlas_dir="$project_dir/public/assets/rpg/atlas"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

required=(
  hero-sheet.png npc-sheet.png field-tiles.png town-tiles.png dungeon-tiles.png
  enemy-pack-a.png enemy-pack-b.png boss-pack.png ui-icons.png
)
for file in "${required[@]}"; do
  if [[ ! -f "$source_dir/$file" ]]; then
    echo "Missing source asset: $source_dir/$file" >&2
    exit 1
  fi
done

mkdir -p "$atlas_dir"

build_atlas() {
  local source_file="$1" columns="$2" rows="$3" cell_width="$4" cell_height="$5" mode="$6" output_file="$7"
  local job_dir="$work_dir/${output_file%.png}"
  local total=$((columns * rows))
  mkdir -p "$job_dir/raw" "$job_dir/cells"

  convert "$source_dir/$source_file" -crop "${columns}x${rows}@" +repage "$job_dir/raw/%03d.png"

  for ((index=0; index<total; index+=1)); do
    local input
    input=$(printf "%s/raw/%03d.png" "$job_dir" "$index")
    local output
    output=$(printf "%s/cells/%03d.png" "$job_dir" "$index")
    if [[ "$mode" == "fill" ]]; then
      convert "$input" -filter point -resize "${cell_width}x${cell_height}!" -alpha on PNG32:"$output"
    elif [[ "$mode" == "trim" ]]; then
      convert "$input" -trim +repage -filter point -resize "$((cell_width - 16))x$((cell_height - 16))" \
        -gravity center -background none -extent "${cell_width}x${cell_height}" PNG32:"$output"
    else
      convert "$input" -filter point -resize "${cell_width}x${cell_height}" \
        -gravity center -background none -extent "${cell_width}x${cell_height}" PNG32:"$output"
    fi
  done

  montage "$job_dir"/cells/*.png -tile "${columns}x${rows}" -geometry +0+0 -background none PNG32:"$atlas_dir/$output_file"
}

# Terrain keeps a dense 64 px source cell. Runtime still renders on a 16 px
# logical grid, so nearest-neighbour downsampling happens once at draw time.
build_atlas field-tiles.png 10 10 64 64 fill field.png
build_atlas town-tiles.png 8 8 64 64 fill town.png
build_atlas dungeon-tiles.png 8 8 64 64 fill dungeon.png

# Character and combat atlases preserve each source cell's aspect ratio.
build_atlas hero-sheet.png 4 4 96 96 contain hero.png
build_atlas npc-sheet.png 4 3 96 128 contain npcs.png
build_atlas enemy-pack-a.png 4 3 128 128 contain enemy-a.png
build_atlas enemy-pack-b.png 8 3 128 128 contain enemy-b.png
build_atlas boss-pack.png 8 3 160 160 contain boss.png
build_atlas ui-icons.png 5 4 96 96 trim ui.png

# A dedicated title portrait avoids enlarging the tiny gameplay sprite.
hero_title_dir="$work_dir/hero-title"
mkdir -p "$hero_title_dir"
convert "$source_dir/hero-sheet.png" -crop 4x4@ +repage "$hero_title_dir/%03d.png"
convert "$hero_title_dir/000.png" -trim +repage -filter point -resize 232x232 \
  -gravity center -background none -extent 256x256 PNG32:"$atlas_dir/hero-title.png"

echo "Rebuilt RPG visual atlases in $atlas_dir"
